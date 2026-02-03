'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, Button, Modal, Form, Badge, ListGroup, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { FaPlus, FaTrash, FaLightbulb } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { mealsApi, dishesApi, suggestionsApi } from '@/lib/api';
import { MealPlan, Dish, MealType, Suggestion } from '@/types';

export default function CalendarioPage() {
  const queryClient = useQueryClient();
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string }>(() => {
    const today = new Date();
    const start = format(today, 'yyyy-MM-dd');
    return { start, end: start };
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('pranzo');
  const [selectedDishId, setSelectedDishId] = useState('');
  const [error, setError] = useState('');

  const toDateOnly = useCallback((value: string) => value.split('T')[0], []);
  const toLocalDate = useCallback((value: string) => new Date(`${toDateOnly(value)}T00:00:00`), [
    toDateOnly,
  ]);
  const toLocalDateFromDateOnly = useCallback((value: string) => new Date(`${value}T00:00:00`), []);

  const { data: meals, isLoading: mealsLoading } = useQuery({
    queryKey: ['meals', 'range', visibleRange.start, visibleRange.end],
    queryFn: () => mealsApi.getRange(visibleRange.start, visibleRange.end),
    enabled: Boolean(visibleRange.start && visibleRange.end),
  });

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
        visibleRange.start,
        visibleRange.end,
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

  const deleteMutation = useMutation({
    mutationFn: mealsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });

  const calendarEvents = useMemo(() => {
    if (!meals) return [];

    return meals.map((meal) => ({
      id: meal.id,
      title: meal.dish.name,
      start: toDateOnly(meal.date),
      allDay: true,
      extendedProps: {
        mealType: meal.mealType,
        category: meal.dish.category,
        dish: meal.dish,
      },
      backgroundColor: meal.mealType === 'pranzo' ? '#f39c12' : '#9b59b6',
      borderColor: meal.mealType === 'pranzo' ? '#f39c12' : '#9b59b6',
    }));
  }, [meals]);

  const handleDateClick = (arg: { date: Date; dateStr: string }) => {
    setSelectedDateStr(arg.dateStr);
    setSelectedDate(toLocalDateFromDateOnly(arg.dateStr));
    setSelectedMealType('pranzo');
    setSelectedDishId('');
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDate(null);
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

  const handleDeleteMeal = (mealId: string) => {
    if (confirm('Rimuovere questo piatto dalla pianificazione?')) {
      deleteMutation.mutate(mealId);
    }
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

  const selectedDateMeals = useMemo(() => {
    if (!selectedDateStr || !meals) return [];
    return meals.filter(
      (meal) => toDateOnly(meal.date) === selectedDateStr && meal.mealType === selectedMealType
    );
  }, [selectedDateStr, selectedMealType, meals, toDateOnly]);

  const eventContent = (eventInfo: any) => {
    const { mealType, category } = eventInfo.event.extendedProps;
    return (
      <div className="p-1">
        <small className="d-block text-truncate">
          {mealType === 'pranzo' ? '🌞' : '🌙'} {eventInfo.event.title}
        </small>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title">Calendario Pasti</h2>
      </div>

      <Card className="calendar-card">
        <Card.Body>
          {mealsLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="success" />
            </div>
          ) : (
            <div className="calendar-shell">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale="it"
                firstDay={1}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,dayGridWeek',
                }}
                events={calendarEvents}
                dateClick={handleDateClick}
                eventContent={eventContent}
                height="auto"
                datesSet={(dateInfo) => {
                  const start = format(dateInfo.start, 'yyyy-MM-dd');
                  const end = format(subDays(dateInfo.end, 1), 'yyyy-MM-dd');
                  setVisibleRange({ start, end });
                }}
                eventClick={(info) => {
                  const meal = meals?.find((m) => m.id === info.event.id);
                  if (meal) {
                    const dateStr = toDateOnly(meal.date);
                    setSelectedDateStr(dateStr);
                    setSelectedDate(toLocalDateFromDateOnly(dateStr));
                    setSelectedMealType(meal.mealType);
                    setSelectedDishId('');
                    setError('');
                    setShowModal(true);
                  }
                }}
              />
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedDate && format(selectedDate, 'EEEE d MMMM yyyy', { locale: it })}
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

              <h6 className="mb-2">Piatti pianificati</h6>
              {selectedDateMeals.length > 0 ? (
                <ListGroup className="mb-3">
                  {selectedDateMeals.map((meal) => (
                    <ListGroup.Item
                      key={meal.id}
                      className="d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <Badge className={`${getCategoryBadgeClass(meal.dish.category)} me-2`}>
                          {meal.dish.category}
                        </Badge>
                        {meal.dish.name}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger"
                        onClick={() => handleDeleteMeal(meal.id)}
                      >
                        <FaTrash />
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <p className="text-muted small mb-3">Nessun piatto pianificato</p>
              )}

              <h6 className="mb-2">Aggiungi piatto</h6>
              {error && <Alert variant="danger">{error}</Alert>}
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
    </DashboardLayout>
  );
}
