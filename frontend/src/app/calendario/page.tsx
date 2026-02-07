'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, Modal, Form, Badge, Spinner, Row, Col } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { FaTrash } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { mealsApi, dishesApi } from '@/lib/api';
import { MealType, DishCategory } from '@/types';
import StatusModal from '@/components/StatusModal';
import ConfirmModal from '@/components/ConfirmModal';

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
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const toDateOnly = useCallback((value: string) => value.split('T')[0], []);
  const toLocalDate = useCallback((value: string) => new Date(`${toDateOnly(value)}T00:00:00`), [
    toDateOnly,
  ]);
  const toLocalDateFromDateOnly = useCallback((value: string) => new Date(`${value}T00:00:00`), []);

  const { data: meals, isLoading: mealsLoading, isFetching: mealsFetching } = useQuery({
    queryKey: ['meals', 'range', visibleRange.start, visibleRange.end],
    queryFn: () => mealsApi.getRange(visibleRange.start, visibleRange.end),
    enabled: Boolean(visibleRange.start && visibleRange.end),
    placeholderData: (previous) => previous,
    staleTime: 30000,
  });

  const { data: dishes } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => dishesApi.list(),
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
    },
  });

  const calendarEvents = useMemo(() => {
    if (!meals) return [];

    return meals.map((meal) => ({
      id: meal.id,
      title: `${meal.mealType === 'pranzo' ? 'Pranzo' : 'Cena'} · ${meal.slotCategory}: ${meal.dish.name}`,
      start: toDateOnly(meal.date),
      allDay: true,
      extendedProps: {
        mealType: meal.mealType,
        category: meal.dish.category,
        slotCategory: meal.slotCategory,
        dish: meal.dish,
      },
      backgroundColor: meal.mealType === 'pranzo' ? '#f39c12' : '#9b59b6',
      borderColor: meal.mealType === 'pranzo' ? '#f39c12' : '#9b59b6',
    }));
  }, [meals]);

  const handleDateClick = (arg: { date: Date; dateStr: string }) => {
    setSelectedDateStr(arg.dateStr);
    setSelectedDate(toLocalDateFromDateOnly(arg.dateStr));
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDate(null);
    setSelectedDateStr(null);
    setError('');
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof mealsApi.update>[1] }) =>
      mealsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleDeleteMeal = (mealId: string) => {
    setPendingDeleteId(mealId);
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

  const slotCategories: DishCategory[] = ['primo', 'secondo', 'contorno'];
  const dishesByCategory = useMemo(() => {
    return {
      primo: dishes?.filter((dish) => dish.category === 'primo') ?? [],
      secondo: dishes?.filter((dish) => dish.category === 'secondo') ?? [],
      contorno: dishes?.filter((dish) => dish.category === 'contorno') ?? [],
    };
  }, [dishes]);

  const getMealBySlot = (dateStr: string, mealType: MealType, slotCategory: DishCategory) => {
    return meals?.find(
      (meal) =>
        toDateOnly(meal.date) === dateStr &&
        meal.mealType === mealType &&
        meal.slotCategory === slotCategory
    );
  };

  const handleSlotChange = (
    dateStr: string,
    mealType: MealType,
    slotCategory: DishCategory,
    dishId: string
  ) => {
    const existing = getMealBySlot(dateStr, mealType, slotCategory);
    if (!dishId) {
      if (existing) {
        deleteMutation.mutate(existing.id);
      }
      return;
    }
    if (existing) {
      if (existing.dishId !== dishId) {
        updateMutation.mutate({ id: existing.id, data: { dishId } });
      }
      return;
    }
    createMutation.mutate({
      date: dateStr,
      mealType,
      slotCategory,
      dishId,
    });
  };

  const eventContent = (eventInfo: any) => {
    const { mealType, slotCategory, dish } = eventInfo.event.extendedProps;
    return (
      <div className="p-1 d-flex align-items-center justify-content-between gap-2">
        <small className="d-block text-truncate">
          {mealType === 'pranzo' ? '🌞' : '🌙'} {slotCategory}: {dish?.name || eventInfo.event.title}
        </small>
        <button
          type="button"
          className="calendar-event-delete"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteMeal(eventInfo.event.id);
          }}
          aria-label="Rimuovi"
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-2">
          <h2 className="page-title mb-0">Calendario Pasti</h2>
          {mealsFetching && !mealsLoading && (
            <Spinner animation="border" size="sm" className="text-light" />
          )}
        </div>
      </div>

      <Card className="calendar-card">
        <Card.Body>
          <div className="calendar-shell position-relative">
            {mealsLoading && !meals && (
              <div className="calendar-loading">
                <Spinner animation="border" variant="success" />
              </div>
            )}
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
                  setError('');
                  setShowModal(true);
                }
              }}
            />
          </div>
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
          <Col md={12}>
            <StatusModal
              show={Boolean(error)}
              variant="danger"
              message={error}
              onClose={() => setError('')}
            />
            {selectedDateStr && (
              <div className="d-flex flex-column gap-3">
                {(['pranzo', 'cena'] as MealType[]).map((mealType) => (
                  <Card key={mealType} className="meal-plan-card">
                    <Card.Body>
                      <Card.Title className="mb-3">
                        {mealType === 'pranzo' ? '☀️ Pranzo' : '🌙 Cena'}
                      </Card.Title>
                      <div className="d-flex flex-column gap-3">
                        {slotCategories.map((slot) => {
                          const meal = getMealBySlot(selectedDateStr, mealType, slot);
                          return (
                            <div
                              key={`${mealType}-${slot}`}
                              className="d-flex align-items-center gap-3"
                            >
                              <span className="meal-slot-label">
                                <Badge className={getCategoryBadgeClass(slot)}>{slot}</Badge>
                              </span>
                              <Form.Select
                                value={meal?.dishId || ''}
                                onChange={(e) =>
                                  handleSlotChange(selectedDateStr, mealType, slot, e.target.value)
                                }
                              >
                                <option value="">Seleziona {slot}...</option>
                                {dishesByCategory[slot].map((dish) => (
                                  <option key={dish.id} value={dish.id}>
                                    {dish.name}
                                  </option>
                                ))}
                              </Form.Select>
                            </div>
                          );
                        })}
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )}
          </Col>
        </Row>
      </Modal.Body>
      </Modal>

      <ConfirmModal
        show={Boolean(pendingDeleteId)}
        message="Rimuovere questo piatto dalla pianificazione?"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteMutation.mutate(pendingDeleteId);
          }
          setPendingDeleteId(null);
        }}
      />
    </DashboardLayout>
  );
}
