'use client';

import { useState } from 'react';
import { Card, Button, Form, ListGroup, Spinner, Badge, Row, Col } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import { FaSync, FaChevronLeft, FaChevronRight, FaCheck, FaShoppingCart } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { shoppingApi } from '@/lib/api';
import { ShoppingListItem } from '@/types';
import StatusModal from '@/components/StatusModal';
import ConfirmModal from '@/components/ConfirmModal';

export default function SpesaPage() {
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dismissError, setDismissError] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const weekString = format(currentWeek, 'yyyy-MM-dd');

  const { data: shoppingList, isLoading, error } = useQuery({
    queryKey: ['shopping', weekString],
    queryFn: () => shoppingApi.get(weekString),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => shoppingApi.regenerate(weekString),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping', weekString] });
    },
  });

  const checkItemMutation = useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      shoppingApi.checkItem(itemId, weekString, checked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping', weekString] });
    },
  });

  const handlePrevWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const handleThisWeek = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const handleToggleItem = (item: ShoppingListItem) => {
    checkItemMutation.mutate({ itemId: item.id, checked: !item.checked });
  };

  const handleRegenerate = () => {
    setShowRegenerateConfirm(true);
  };

  const items = shoppingList?.items || [];
  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title">Lista della Spesa</h2>
        <Button
          variant="outline-primary"
          onClick={handleRegenerate}
          disabled={regenerateMutation.isPending}
        >
          {regenerateMutation.isPending ? (
            <Spinner size="sm" animation="border" />
          ) : (
            <>
              <FaSync className="me-1" /> Rigenera
            </>
          )}
        </Button>
      </div>

      <Card className="mb-4">
        <Card.Body>
          <Row className="align-items-center">
            <Col>
              <div className="d-flex align-items-center gap-2">
                <Button variant="outline-secondary" size="sm" onClick={handlePrevWeek}>
                  <FaChevronLeft />
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={handleThisWeek}>
                  Oggi
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={handleNextWeek}>
                  <FaChevronRight />
                </Button>
                <span className="ms-2">
                  Settimana del{' '}
                  <strong>{format(currentWeek, 'd MMMM yyyy', { locale: it })}</strong>
                </span>
              </div>
            </Col>
            <Col xs="auto">
              {totalCount > 0 && (
                <div className="d-flex align-items-center gap-2">
                  <div className="progress bubble-progress" style={{ width: 120, height: 10 }}>
                    <div
                      className="progress-bar bubble-progress-bar"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <small className="text-muted">
                    {checkedCount}/{totalCount}
                  </small>
                </div>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {isLoading ? (
        <Card>
          <Card.Body className="text-center py-5">
            <Spinner animation="border" variant="success" />
          </Card.Body>
        </Card>
      ) : error ? (
        <>
          <StatusModal
            show={!dismissError}
            variant="danger"
            message="Errore nel caricamento della lista"
            onClose={() => setDismissError(true)}
          />
          <Card>
            <Card.Body className="text-center py-5">
              <p className="text-muted mb-0">Errore nel caricamento della lista</p>
            </Card.Body>
          </Card>
        </>
      ) : items.length > 0 ? (
        <Card>
          <ListGroup variant="flush">
            {items
              .sort((a, b) => {
                // Show unchecked first
                if (a.checked !== b.checked) {
                  return a.checked ? 1 : -1;
                }
                return a.ingredient.localeCompare(b.ingredient);
              })
              .map((item) => (
                <ListGroup.Item
                  key={item.id}
                  className={`shopping-item d-flex align-items-center gap-3 ${
                    item.checked ? 'checked' : ''
                  }`}
                >
                  <Form.Check
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleToggleItem(item)}
                    id={`item-${item.id}`}
                  />
                  <div className="flex-grow-1">
                    <div className={item.checked ? 'text-decoration-line-through text-muted' : ''}>
                      {item.ingredient}
                      {item.quantity && (
                        <span className="text-muted ms-2">({item.quantity})</span>
                      )}
                    </div>
                    {item.dishNames.length > 0 && (
                      <small className="text-muted">
                        Per: {item.dishNames.join(', ')}
                      </small>
                    )}
                  </div>
                  {item.checked && <FaCheck className="text-success" />}
                </ListGroup.Item>
              ))}
          </ListGroup>
        </Card>
      ) : (
        <Card>
          <Card.Body className="text-center py-5">
            <FaShoppingCart size={48} className="text-muted mb-3" />
            <p className="text-muted mb-0">
              Nessun ingrediente nella lista per questa settimana.
            </p>
            <p className="text-muted small">
              Pianifica i pasti nel calendario per generare la lista della spesa.
            </p>
          </Card.Body>
        </Card>
      )}

      <ConfirmModal
        show={showRegenerateConfirm}
        message="Rigenerare la lista? Le modifiche manuali andranno perse."
        onCancel={() => setShowRegenerateConfirm(false)}
        onConfirm={() => {
          setShowRegenerateConfirm(false);
          regenerateMutation.mutate();
        }}
      />
    </DashboardLayout>
  );
}
