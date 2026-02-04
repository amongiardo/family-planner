'use client';

import { useState, useMemo, useRef } from 'react';
import { Row, Col, Card, Button, Badge, ListGroup, Spinner, Modal, Form } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfWeek, addWeeks, subWeeks, differenceInCalendarDays } from 'date-fns';
import { it } from 'date-fns/locale';
import Link from 'next/link';
import { FaPlus, FaLightbulb, FaCalendarAlt, FaTimes } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { mealsApi, suggestionsApi, dishesApi, familyApi, weatherApi } from '@/lib/api';
import { MealPlan, MealType, Suggestion } from '@/types';
import StatusModal from '@/components/StatusModal';
import ConfirmModal from '@/components/ConfirmModal';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: familyApi.get,
  });
  const city = family?.city || 'Roma';
  const { data: weather } = useQuery({
    queryKey: ['weather', city],
    queryFn: () => weatherApi.get(city),
  });
  const initialWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const initialDayIndex = Math.min(
    Math.max(differenceInCalendarDays(today, initialWeekStart), 0),
    6
  );
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [selectedDayIndex, setSelectedDayIndex] = useState(initialDayIndex);
  const rangeStart = format(weekStart, 'yyyy-MM-dd');
  const rangeEnd = format(addDays(weekStart, 6), 'yyyy-MM-dd');
  const touchStart = useRef<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('pranzo');
  const [selectedDishId, setSelectedDishId] = useState('');
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: meals, isLoading: mealsLoading } = useQuery({
    queryKey: ['meals', 'range', rangeStart, rangeEnd],
    queryFn: () => mealsApi.getRange(rangeStart, rangeEnd),
  });

  const { data: lunchSuggestions } = useQuery({
    queryKey: ['suggestions', format(today, 'yyyy-MM-dd'), 'pranzo'],
    queryFn: () => suggestionsApi.get(format(today, 'yyyy-MM-dd'), 'pranzo'),
  });

  const { data: dinnerSuggestions } = useQuery({
    queryKey: ['suggestions', format(today, 'yyyy-MM-dd'), 'cena'],
    queryFn: () => suggestionsApi.get(format(today, 'yyyy-MM-dd'), 'cena'),
  });

  const days = useMemo(
    () =>
      [...Array(7)].map((_, i) => {
        const day = addDays(weekStart, i);
        return {
          date: day,
          short: format(day, 'EE', { locale: it }).toUpperCase(),
          number: format(day, 'd'),
        };
      }),
    [weekStart]
  );

  const getMealsByDayAndType = (dayOffset: number, mealType: MealType) => {
    const day = addDays(weekStart, dayOffset);
    return meals?.filter(
      (meal) =>
        format(new Date(meal.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') &&
        meal.mealType === mealType
    );
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'primo':
        return 'badge-primo';
      case 'secondo':
        return 'badge-secondo';
      case 'contorno':
        return 'badge-contorno';
      default:
        return 'bg-secondary';
    }
  };

  const pickEmoji = (meal: MealPlan) => {
    switch (meal.dish.category) {
      case 'primo':
        return '🍝';
      case 'secondo':
        return '🥩';
      case 'contorno':
        return '🥗';
      default:
        return '🍽️';
    }
  };

  const selectedDay = days[selectedDayIndex] ?? days[0];
  const lunchMeal = getMealsByDayAndType(selectedDayIndex, 'pranzo')?.[0];
  const dinnerMeal = getMealsByDayAndType(selectedDayIndex, 'cena')?.[0];

  const { data: dishes } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => dishesApi.list(),
  });

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['suggestions', selectedDateStr || '', selectedMealType],
    queryFn: () =>
      selectedDateStr
        ? suggestionsApi.get(selectedDateStr, selectedMealType)
        : Promise.resolve([]),
    enabled: !!selectedDateStr,
  });

  const createMutation = useMutation({
    mutationFn: mealsApi.create,
    onSuccess: (meal) => {
      const cachedMeals = queryClient.getQueryData<MealPlan[]>([
        'meals',
        'range',
        rangeStart,
        rangeEnd,
      ]);
      const alreadyPlanned = cachedMeals?.some((existing) => existing.id === meal.id);

      if (alreadyPlanned) {
        setError('Piatto già pianificato per questa data e pasto');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      handleCloseModal();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMealMutation = useMutation({
    mutationFn: mealsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });

  const handleOpenModal = (mealType: MealType) => {
    const dateStr = format(addDays(weekStart, selectedDayIndex), 'yyyy-MM-dd');
    setSelectedDateStr(dateStr);
    setSelectedMealType(mealType);
    setSelectedDishId('');
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDateStr(null);
    setSelectedDishId('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDateStr || !selectedDishId) {
      setError('Seleziona un piatto');
      return;
    }

    createMutation.mutate({
      date: selectedDateStr,
      mealType: selectedMealType,
      dishId: selectedDishId,
    });
  };

  const handleAcceptSuggestion = (suggestion: Suggestion) => {
    if (!selectedDateStr) return;

    createMutation.mutate({
      date: selectedDateStr,
      mealType: selectedMealType,
      dishId: suggestion.dish.id,
      isSuggestion: true,
    });
  };

  const handleRemoveMeal = (mealId: string) => {
    setPendingDeleteId(mealId);
  };

  const handlePrevWeek = () => {
    setWeekStart((prev) => subWeeks(prev, 1));
    setSelectedDayIndex(0);
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => addWeeks(prev, 1));
    setSelectedDayIndex(0);
  };

  const handleThisWeek = () => {
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const index = Math.min(Math.max(differenceInCalendarDays(today, start), 0), 6);
    setWeekStart(start);
    setSelectedDayIndex(index);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStart.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - event.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNextWeek();
      if (diff < 0) handlePrevWeek();
    }
    touchStart.current = null;
  };

  return (
    <DashboardLayout>
      <div className="dashboard-hero">
        <div>
          <p className="dashboard-kicker">👋 Benvenuto!</p>
          <h1 className="dashboard-title">Meal Planner 🍽️</h1>
          <p className="dashboard-date">
            {format(today, 'EEEE d MMMM yyyy', { locale: it })} · {city}
            {weather?.temperature !== undefined && weather?.description
              ? ` · ${Math.round(weather.temperature)}°C ${weather.description}`
              : weather?.temperature !== undefined
                ? ` · ${Math.round(weather.temperature)}°C`
                : ''}
          </p>
        </div>
        <div className="dashboard-avatar">👨‍👩‍👧</div>
      </div>

      <div className="week-strip">
        <Button variant="outline-primary" size="sm" onClick={handleThisWeek}>
          Oggi
        </Button>
        {[-1, 0, 1].map((offset) => {
          const base = addWeeks(weekStart, offset);
          const label = `${format(base, 'd MMM', { locale: it })}–${format(
            addDays(base, 6),
            'd MMM',
            { locale: it }
          )}`;
          const isActive = offset === 0;
          return (
            <button
              key={label}
              className={`week-pill ${isActive ? 'active' : ''}`}
              onClick={() => {
                setWeekStart(base);
                setSelectedDayIndex(0);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="day-strip" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {days.map((day, i) => {
          const pranzo = getMealsByDayAndType(i, 'pranzo')?.length;
          const cena = getMealsByDayAndType(i, 'cena')?.length;
          const isActive = i === selectedDayIndex;
          const isToday = format(day.date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
          return (
            <button
              key={day.number}
              className={`day-pill ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setSelectedDayIndex(i)}
            >
              <span className="day-pill-short">{day.short}</span>
              <span className="day-pill-number">{day.number}</span>
              <div className="day-pill-dots">
                <span className={`day-pill-dot ${pranzo ? 'filled lunch' : ''}`} />
                <span className={`day-pill-dot ${cena ? 'filled dinner' : ''}`} />
              </div>
            </button>
          );
        })}
      </div>

      {mealsLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
        </div>
      ) : (
        <Row className="g-4">
          <Col lg={8}>
            <div className="meal-section">
              {lunchMeal ? (
                <Card className="meal-bubble-card meal-bubble-lunch mb-3">
                  <Card.Body>
                    <div className="meal-bubble-header">
                      <div className="d-flex align-items-center gap-2">
                        <span className="meal-bubble-label">☀️ Pranzo</span>
                        <Badge className={getCategoryBadgeClass(lunchMeal.dish.category)}>
                          {lunchMeal.dish.category}
                        </Badge>
                      </div>
                      <button
                        type="button"
                        className="meal-bubble-delete"
                        onClick={() => handleRemoveMeal(lunchMeal.id)}
                        aria-label="Rimuovi pranzo"
                      >
                        <FaTimes />
                      </button>
                    </div>
                    <div className="meal-bubble-main">
                      <div className="meal-bubble-emoji">{pickEmoji(lunchMeal)}</div>
                      <div>
                        <h3 className="meal-bubble-title">{lunchMeal.dish.name}</h3>
                      </div>
                    </div>
                    {lunchMeal.dish.ingredients.length > 0 && (
                      <div className="meal-bubble-ingredients">
                        {lunchMeal.dish.ingredients.map((ing) => (
                          <span key={ing} className="ingredient-tag">
                            {ing}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              ) : (
                <Card className="meal-add-card mb-3" onClick={() => handleOpenModal('pranzo')}>
                  <Card.Body>
                    <div className="meal-add-icon">＋</div>
                    <span>Aggiungi Pranzo</span>
                  </Card.Body>
                </Card>
              )}

              {dinnerMeal ? (
                <Card className="meal-bubble-card meal-bubble-dinner">
                  <Card.Body>
                    <div className="meal-bubble-header">
                      <div className="d-flex align-items-center gap-2">
                        <span className="meal-bubble-label">🌙 Cena</span>
                        <Badge className={getCategoryBadgeClass(dinnerMeal.dish.category)}>
                          {dinnerMeal.dish.category}
                        </Badge>
                      </div>
                      <button
                        type="button"
                        className="meal-bubble-delete"
                        onClick={() => handleRemoveMeal(dinnerMeal.id)}
                        aria-label="Rimuovi cena"
                      >
                        <FaTimes />
                      </button>
                    </div>
                    <div className="meal-bubble-main">
                      <div className="meal-bubble-emoji">{pickEmoji(dinnerMeal)}</div>
                      <div>
                        <h3 className="meal-bubble-title">{dinnerMeal.dish.name}</h3>
                      </div>
                    </div>
                    {dinnerMeal.dish.ingredients.length > 0 && (
                      <div className="meal-bubble-ingredients">
                        {dinnerMeal.dish.ingredients.map((ing) => (
                          <span key={ing} className="ingredient-tag">
                            {ing}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              ) : (
                <Card className="meal-add-card" onClick={() => handleOpenModal('cena')}>
                  <Card.Body>
                    <div className="meal-add-icon">＋</div>
                    <span>Aggiungi Cena</span>
                  </Card.Body>
                </Card>
              )}
            </div>
          </Col>

          <Col lg={4}>
            <Card className="mb-4">
              <Card.Header className="d-flex align-items-center gap-2">
                <FaLightbulb /> Suggerimenti per Oggi
              </Card.Header>
              <Card.Body>
                <h6 className="text-muted">Pranzo</h6>
                <ListGroup variant="flush" className="mb-3">
                  {lunchSuggestions?.slice(0, 3).map((suggestion) => (
                    <ListGroup.Item
                      key={suggestion.dish.id}
                      className="d-flex justify-content-between align-items-center px-0"
                    >
                      <div>
                        <Badge className={`${getCategoryBadgeClass(suggestion.dish.category)} me-2`}>
                          {suggestion.dish.category}
                        </Badge>
                        {suggestion.dish.name}
                      </div>
                    </ListGroup.Item>
                  ))}
                  {(!lunchSuggestions || lunchSuggestions.length === 0) && (
                    <ListGroup.Item className="px-0 text-muted small">
                      Aggiungi piatti per ricevere suggerimenti
                    </ListGroup.Item>
                  )}
                </ListGroup>

                <h6 className="text-muted">Cena</h6>
                <ListGroup variant="flush">
                  {dinnerSuggestions?.slice(0, 3).map((suggestion) => (
                    <ListGroup.Item
                      key={suggestion.dish.id}
                      className="d-flex justify-content-between align-items-center px-0"
                    >
                      <div>
                        <Badge className={`${getCategoryBadgeClass(suggestion.dish.category)} me-2`}>
                          {suggestion.dish.category}
                        </Badge>
                        {suggestion.dish.name}
                      </div>
                    </ListGroup.Item>
                  ))}
                  {(!dinnerSuggestions || dinnerSuggestions.length === 0) && (
                    <ListGroup.Item className="px-0 text-muted small">
                      Aggiungi piatti per ricevere suggerimenti
                    </ListGroup.Item>
                  )}
                </ListGroup>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>Azioni rapide</Card.Header>
              <Card.Body className="d-grid gap-2">
                <Link href="/calendario" passHref>
                  <Button variant="outline-primary" className="d-flex align-items-center gap-2 w-100">
                    <FaCalendarAlt /> Apri Calendario
                  </Button>
                </Link>
                <Link href="/piatti" passHref>
                  <Button variant="outline-primary" className="d-flex align-items-center gap-2 w-100">
                    <FaPlus /> Aggiungi Piatto
                  </Button>
                </Link>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedDateStr && format(new Date(`${selectedDateStr}T00:00:00`), 'EEEE d MMMM yyyy', { locale: it })}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row>
            <Col md={6}>
              <div className="mb-3">
                <div className="btn-group w-100" role="group">
                  <Button
                    variant={selectedMealType === 'pranzo' ? 'warning' : 'outline-warning'}
                    onClick={() => setSelectedMealType('pranzo')}
                  >
                    🌞 Pranzo
                  </Button>
                  <Button
                    variant={selectedMealType === 'cena' ? 'primary' : 'outline-primary'}
                    onClick={() => setSelectedMealType('cena')}
                    style={{
                      backgroundColor: selectedMealType === 'cena' ? '#9b59b6' : 'transparent',
                      borderColor: '#9b59b6',
                      color: selectedMealType === 'cena' ? 'white' : '#9b59b6',
                    }}
                  >
                    🌙 Cena
                  </Button>
                </div>
              </div>

              <h6 className="mb-2">Aggiungi piatto</h6>
              <StatusModal
                show={Boolean(error)}
                variant="danger"
                message={error}
                onClose={() => setError('')}
              />
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Select
                    value={selectedDishId}
                    onChange={(e) => setSelectedDishId(e.target.value)}
                  >
                    <option value="">Seleziona un piatto...</option>
                    {dishes?.map((dish) => (
                      <option key={dish.id} value={dish.id}>
                        [{dish.category}] {dish.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!selectedDishId || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Spinner size="sm" animation="border" />
                  ) : (
                    <>
                      <FaPlus className="me-1" /> Aggiungi
                    </>
                  )}
                </Button>
              </Form>
            </Col>

            <Col md={6}>
              <div className="d-flex align-items-center gap-2 mb-3">
                <FaLightbulb className="text-warning" />
                <h6 className="mb-0">Suggerimenti</h6>
              </div>

              {suggestionsLoading ? (
                <div className="text-center py-3">
                  <Spinner size="sm" animation="border" variant="success" />
                </div>
              ) : suggestions && suggestions.length > 0 ? (
                <ListGroup>
                  {suggestions.map((suggestion) => (
                    <ListGroup.Item
                      key={suggestion.dish.id}
                      action
                      onClick={() => handleAcceptSuggestion(suggestion)}
                      className="suggestion-card"
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <Badge
                            className={`${getCategoryBadgeClass(suggestion.dish.category)} me-2`}
                          >
                            {suggestion.dish.category}
                          </Badge>
                          {suggestion.dish.name}
                        </div>
                        <FaPlus className="text-success" />
                      </div>
                      <small className="text-muted">{suggestion.reason}</small>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <p className="text-muted small">
                  Aggiungi piatti alla tua lista per ricevere suggerimenti
                </p>
              )}
            </Col>
          </Row>
        </Modal.Body>
      </Modal>

      <ConfirmModal
        show={Boolean(pendingDeleteId)}
        message="Rimuovere questo pasto dalla giornata?"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteMealMutation.mutate(pendingDeleteId);
          }
          setPendingDeleteId(null);
        }}
      />
    </DashboardLayout>
  );
}
