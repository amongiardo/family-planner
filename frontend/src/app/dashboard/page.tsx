'use client';

import { useState, useMemo } from 'react';
import { Row, Col, Card, Button, Badge, ListGroup, Spinner } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import Link from 'next/link';
import { FaPlus, FaLightbulb, FaCalendarAlt } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { mealsApi, suggestionsApi } from '@/lib/api';
import { MealPlan, MealType } from '@/types';

export default function DashboardPage() {
  const today = new Date();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const rangeStart = format(today, 'yyyy-MM-dd');
  const rangeEnd = format(addDays(today, 6), 'yyyy-MM-dd');

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
        const day = addDays(today, i);
        return {
          date: day,
          short: format(day, 'EE', { locale: it }).toUpperCase(),
          number: format(day, 'd'),
        };
      }),
    [today]
  );

  const getMealsByDayAndType = (dayOffset: number, mealType: MealType) => {
    const day = addDays(today, dayOffset);
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

  return (
    <DashboardLayout>
      <div className="dashboard-hero">
        <div>
          <p className="dashboard-kicker">👋 Benvenuto!</p>
          <h1 className="dashboard-title">
            Meal
            <br />
            Planner 🍽️
          </h1>
          <p className="dashboard-date">{format(today, 'EEEE d MMMM yyyy', { locale: it })}</p>
        </div>
        <div className="dashboard-avatar">👨‍👩‍👧</div>
      </div>

      <div className="day-strip">
        {days.map((day, i) => {
          const pranzo = getMealsByDayAndType(i, 'pranzo')?.length;
          const cena = getMealsByDayAndType(i, 'cena')?.length;
          const isActive = i === selectedDayIndex;
          return (
            <button
              key={day.number}
              className={`day-pill ${isActive ? 'active' : ''}`}
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
                      <span className="meal-bubble-label">☀️ Pranzo</span>
                      <Badge className={getCategoryBadgeClass(lunchMeal.dish.category)}>
                        {lunchMeal.dish.category}
                      </Badge>
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
                <Link href="/calendario" className="text-decoration-none">
                  <Card className="meal-add-card mb-3">
                    <Card.Body>
                      <div className="meal-add-icon">＋</div>
                      <span>Aggiungi Pranzo</span>
                    </Card.Body>
                  </Card>
                </Link>
              )}

              {dinnerMeal ? (
                <Card className="meal-bubble-card meal-bubble-dinner">
                  <Card.Body>
                    <div className="meal-bubble-header">
                      <span className="meal-bubble-label">🌙 Cena</span>
                      <Badge className={getCategoryBadgeClass(dinnerMeal.dish.category)}>
                        {dinnerMeal.dish.category}
                      </Badge>
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
                <Link href="/calendario" className="text-decoration-none">
                  <Card className="meal-add-card">
                    <Card.Body>
                      <div className="meal-add-icon">＋</div>
                      <span>Aggiungi Cena</span>
                    </Card.Body>
                  </Card>
                </Link>
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
    </DashboardLayout>
  );
}
