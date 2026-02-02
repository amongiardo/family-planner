'use client';

import { useState } from 'react';
import { Row, Col, Card, Button, Badge, ListGroup, Spinner, Alert } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, addDays, addWeeks, isToday, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import Link from 'next/link';
import { FaPlus, FaLightbulb, FaCalendarAlt } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { mealsApi, suggestionsApi } from '@/lib/api';
import { MealPlan, Suggestion, MealType } from '@/types';

export default function DashboardPage() {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(startOfWeek(today, { weekStartsOn: 1 }));
  const weekString = format(weekStart, 'yyyy-MM-dd');

  const { data: meals, isLoading: mealsLoading } = useQuery({
    queryKey: ['meals', weekString],
    queryFn: () => mealsApi.getWeek(weekString),
  });

  const { data: lunchSuggestions } = useQuery({
    queryKey: ['suggestions', format(today, 'yyyy-MM-dd'), 'pranzo'],
    queryFn: () => suggestionsApi.get(format(today, 'yyyy-MM-dd'), 'pranzo'),
  });

  const { data: dinnerSuggestions } = useQuery({
    queryKey: ['suggestions', format(today, 'yyyy-MM-dd'), 'cena'],
    queryFn: () => suggestionsApi.get(format(today, 'yyyy-MM-dd'), 'cena'),
  });

  const todayMeals = meals?.filter(
    (meal) => format(parseISO(meal.date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
  );

  const getMealsByDayAndType = (dayOffset: number, mealType: MealType) => {
    const day = addDays(weekStart, dayOffset);
    return meals?.filter(
      (meal) =>
        format(parseISO(meal.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') &&
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

  return (
    <DashboardLayout>
      <div className="mb-4">
        <h2>Dashboard</h2>
        <p className="text-muted">{format(today, "EEEE d MMMM yyyy", { locale: it })}</p>
      </div>

      <Row>
        <Col lg={8}>
          {/* Today's Meals */}
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Pasti di Oggi</span>
              <Link href="/calendario" passHref>
                <Button variant="outline-primary" size="sm">
                  <FaCalendarAlt className="me-1" /> Vai al Calendario
                </Button>
              </Link>
            </Card.Header>
            <Card.Body>
              {mealsLoading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="success" />
                </div>
              ) : todayMeals && todayMeals.length > 0 ? (
                <Row>
                  <Col md={6}>
                    <h6 className="text-muted mb-3">Pranzo</h6>
                    {todayMeals
                      .filter((m) => m.mealType === 'pranzo')
                      .map((meal) => (
                        <div key={meal.id} className="mb-2 p-2 bg-light rounded">
                          <Badge className={`${getCategoryBadgeClass(meal.dish.category)} me-2`}>
                            {meal.dish.category}
                          </Badge>
                          {meal.dish.name}
                        </div>
                      ))}
                    {todayMeals.filter((m) => m.mealType === 'pranzo').length === 0 && (
                      <p className="text-muted small">Nessun piatto pianificato</p>
                    )}
                  </Col>
                  <Col md={6}>
                    <h6 className="text-muted mb-3">Cena</h6>
                    {todayMeals
                      .filter((m) => m.mealType === 'cena')
                      .map((meal) => (
                        <div key={meal.id} className="mb-2 p-2 bg-light rounded">
                          <Badge className={`${getCategoryBadgeClass(meal.dish.category)} me-2`}>
                            {meal.dish.category}
                          </Badge>
                          {meal.dish.name}
                        </div>
                      ))}
                    {todayMeals.filter((m) => m.mealType === 'cena').length === 0 && (
                      <p className="text-muted small">Nessun piatto pianificato</p>
                    )}
                  </Col>
                </Row>
              ) : (
                <Alert variant="info">
                  Nessun pasto pianificato per oggi.{' '}
                  <Link href="/calendario">Pianifica adesso</Link>
                </Alert>
              )}
            </Card.Body>
          </Card>

          {/* Weekly Overview */}
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Panoramica Settimana</span>
              <div className="d-flex align-items-center gap-2">
                <Button
                  variant="outline-success"
                  size="sm"
                  onClick={() => setWeekStart(startOfWeek(today, { weekStartsOn: 1 }))}
                >
                  Oggi
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setWeekStart(addWeeks(weekStart, -1))}
                >
                  ←
                </Button>
                <span className="small text-muted">
                  {format(weekStart, 'd MMM', { locale: it })} –{' '}
                  {format(addDays(weekStart, 6), 'd MMM', { locale: it })}
                </span>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                >
                  →
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <table className="table table-bordered mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '100px' }}></th>
                      {[...Array(7)].map((_, i) => {
                        const day = addDays(weekStart, i);
                        return (
                          <th
                            key={i}
                            className={`text-center ${isToday(day) ? 'bg-success bg-opacity-10' : ''}`}
                          >
                            <div className="small">{format(day, 'EEE', { locale: it })}</div>
                            <div>{format(day, 'd')}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-muted small">Pranzo</td>
                      {[...Array(7)].map((_, i) => {
                        const dayMeals = getMealsByDayAndType(i, 'pranzo');
                        const day = addDays(weekStart, i);
                        return (
                          <td
                            key={i}
                            className={`small ${isToday(day) ? 'bg-success bg-opacity-10' : ''}`}
                            style={{ minWidth: '100px' }}
                          >
                            {dayMeals?.map((m) => (
                              <div key={m.id} className="text-truncate" title={m.dish.name}>
                                {m.dish.name}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="text-muted small">Cena</td>
                      {[...Array(7)].map((_, i) => {
                        const dayMeals = getMealsByDayAndType(i, 'cena');
                        const day = addDays(weekStart, i);
                        return (
                          <td
                            key={i}
                            className={`small ${isToday(day) ? 'bg-success bg-opacity-10' : ''}`}
                            style={{ minWidth: '100px' }}
                          >
                            {dayMeals?.map((m) => (
                              <div key={m.id} className="text-truncate" title={m.dish.name}>
                                {m.dish.name}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          {/* Suggestions */}
          <Card className="mb-4">
            <Card.Header className="d-flex align-items-center gap-2">
              <FaLightbulb className="text-warning" /> Suggerimenti per Oggi
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

          {/* Quick Actions */}
          <Card>
            <Card.Header>Azioni Rapide</Card.Header>
            <Card.Body className="d-grid gap-2">
              <Link href="/piatti" passHref>
                <Button variant="outline-primary" className="d-flex align-items-center gap-2 w-100">
                  <FaPlus /> Aggiungi Piatto
                </Button>
              </Link>
              <Link href="/spesa" passHref>
                <Button variant="outline-success" className="d-flex align-items-center gap-2 w-100">
                  Lista della Spesa
                </Button>
              </Link>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </DashboardLayout>
  );
}
