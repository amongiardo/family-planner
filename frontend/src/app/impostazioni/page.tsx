'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Form,
  ListGroup,
  Spinner,
  InputGroup,
  Image,
  Row,
  Col,
  Badge,
} from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { FaEnvelope, FaTrash, FaCopy, FaCheck } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { familyApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import StatusModal from '@/components/StatusModal';
import ConfirmModal from '@/components/ConfirmModal';
import type { Family } from '@/types';

export default function ImpostazioniPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [familyName, setFamilyName] = useState('');
  const [familyCity, setFamilyCity] = useState('Roma');
  const [inviteEmail, setInviteEmail] = useState('');
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingInviteDelete, setPendingInviteDelete] = useState<string | null>(null);

  const { data: family, isLoading } = useQuery<Family>({
    queryKey: ['family'],
    queryFn: familyApi.get,
  });

  useEffect(() => {
    if (!family) return;
    if (!familyName) {
      setFamilyName(family.name);
    }
    if (family.city) {
      setFamilyCity(family.city);
    }
  }, [family, familyName]);

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: ['invites'],
    queryFn: familyApi.getInvites,
    enabled: isAdmin,
  });

  const updateFamilyMutation = useMutation({
    mutationFn: familyApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      setSuccess('Nome famiglia aggiornato');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const regenerateAuthCodeMutation = useMutation({
    mutationFn: familyApi.regenerateAuthCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      setSuccess('Codice rigenerato');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: familyApi.invite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      setInviteEmail('');
      setSuccess('Invito inviato con successo');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: ({ id, authCode }: { id: string; authCode: string }) =>
      familyApi.deleteInvite(id, authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });

  const handleUpdateFamily = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isAdmin) {
      setError('Solo l’amministratore può modificare le impostazioni della famiglia');
      return;
    }
    if (familyName.trim() || familyCity.trim()) {
      updateFamilyMutation.mutate({ name: familyName.trim(), city: familyCity.trim() });
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isAdmin) {
      setError('Solo l’amministratore può invitare nuovi membri');
      return;
    }
    if (inviteEmail.trim()) {
      inviteMutation.mutate(inviteEmail.trim());
    }
  };

  const handleCopyInvite = async (inviteUrl: string, inviteId: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(inviteId);
      setTimeout(() => setCopiedInvite(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDeleteInvite = (id: string) => {
    setPendingInviteDelete(id);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h2 className="mb-4 page-title">Impostazioni</h2>

      <StatusModal
        show={Boolean(error)}
        variant="danger"
        message={error}
        onClose={() => setError('')}
      />
      <StatusModal
        show={Boolean(success)}
        variant="success"
        message={success}
        onClose={() => setSuccess('')}
      />

      <Card className="mb-4">
        <Card.Header>Riepilogo</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <div className="fw-bold">Famiglia</div>
              <div className="text-muted">{family?.name || '—'}</div>
            </Col>
            <Col md={4}>
              <div className="fw-bold">Città</div>
              <div className="text-muted">{family?.city || 'Roma'}</div>
            </Col>
            <Col md={4}>
              <div className="fw-bold">Membri</div>
              {family?.users && family.users.length > 0 && (
                <div className="mt-2">
                  {family.users.map((member) => (
                    <div key={member.id} className="text-muted small">
                      {member.name}
                    </div>
                  ))}
                </div>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row>
        <Col lg={6}>
          <Card className="mb-4">
            <Card.Header>Famiglia</Card.Header>
            <Card.Body>
              {isAdmin ? (
                <Form onSubmit={handleUpdateFamily}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome Famiglia</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      className="placeholder-soft"
                      placeholder="es: Nome della famiglia"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={updateFamilyMutation.isPending}
                    >
                      {updateFamilyMutation.isPending ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        'Salva'
                      )}
                    </Button>
                  </InputGroup>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Città per meteo</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      value={familyCity}
                      onChange={(e) => setFamilyCity(e.target.value)}
                      className="placeholder-soft"
                      placeholder="es: Roma"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={updateFamilyMutation.isPending}
                    >
                      {updateFamilyMutation.isPending ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        'Salva'
                      )}
                    </Button>
                  </InputGroup>
                </Form.Group>
              </Form>
              ) : (
                <div className="text-muted">
                  Solo l’amministratore può modificare nome famiglia e città.
                </div>
              )}

              {isAdmin && (
                <div className="mt-3">
                  <Form.Label>Codice di autenticazione</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      value={family?.authCode || ''}
                      readOnly
                      className="placeholder-soft"
                      placeholder="—"
                    />
                    <Button
                      variant="outline-primary"
                      className="btn-primary-soft"
                      onClick={() => regenerateAuthCodeMutation.mutate()}
                      disabled={regenerateAuthCodeMutation.isPending}
                    >
                      {regenerateAuthCodeMutation.isPending ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        'Rigenera'
                      )}
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    Serve per confermare azioni di cancellazione/svuotamento.
                  </Form.Text>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-4 settings-card">
            <Card.Header>Membri della Famiglia</Card.Header>
            <ListGroup variant="flush" className="settings-list">
              {family?.users.map((member) => (
                <ListGroup.Item key={member.id} className="family-member-item">
                  {member.avatarUrl ? (
                    <Image
                      src={member.avatarUrl}
                      roundedCircle
                      width={40}
                      height={40}
                      alt={member.name}
                    />
                  ) : (
                    <div
                      className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                      style={{ width: 40, height: 40 }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                    <div className="family-member-details">
                    <div className="fw-medium">
                      {member.name}
                      {member.id === user?.id && (
                        <Badge bg="secondary" className="ms-2">
                          Tu
                        </Badge>
                      )}
                      {member.role === 'admin' && (
                        <Badge bg="success" className="ms-2">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <small className="text-muted">{member.email}</small>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </Col>

        <Col lg={6}>
          {!isAdmin ? (
            <Card className="mb-4">
              <Card.Header>Inviti</Card.Header>
              <Card.Body className="text-muted">
                Solo l’amministratore può invitare nuovi membri.
              </Card.Body>
            </Card>
          ) : (
          <Card className="mb-4">
            <Card.Header>Invita Membri</Card.Header>
            <Card.Body>
              <Form onSubmit={handleInvite}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaEnvelope />
                    </InputGroup.Text>
                    <Form.Control
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="placeholder-soft"
                      placeholder="es: email@esempio.com"
                      required
                    />
                    <Button type="submit" variant="primary" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        'Invita'
                      )}
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    L'invitato riceverà un link per unirsi alla famiglia
                  </Form.Text>
                </Form.Group>
              </Form>
            </Card.Body>
          </Card>
          )}

          {isAdmin && (
            <Card className="settings-card">
            <Card.Header>Inviti Pendenti</Card.Header>
            {invitesLoading ? (
              <Card.Body className="text-center">
                <Spinner size="sm" animation="border" variant="success" />
              </Card.Body>
            ) : invites && invites.length > 0 ? (
              <ListGroup variant="flush" className="settings-list">
                {invites.map((invite) => (
                  <ListGroup.Item key={invite.id}>
                    <div className="invite-item">
                      <div className="invite-item-text">
                        <div className="fw-medium">{invite.email}</div>
                        <small className="text-muted">
                          Scade il{' '}
                          {format(parseISO(invite.expiresAt), 'd MMM yyyy', { locale: it })}
                        </small>
                      </div>
                      <div className="invite-item-actions">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-1 btn-primary-soft"
                          onClick={() =>
                            handleCopyInvite(
                              invite.inviteUrl ??
                                `${window.location.origin}/invite/${invite.token ?? invite.id}`,
                              invite.id
                            )
                          }
                          title="Copia link"
                        >
                          {copiedInvite === invite.id ? <FaCheck /> : <FaCopy />}
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="btn-danger-soft"
                          onClick={() => handleDeleteInvite(invite.id)}
                          title="Annulla invito"
                        >
                          <FaTrash />
                        </Button>
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            ) : (
              <Card.Body className="text-muted">Nessun invito pendente</Card.Body>
            )}
          </Card>
          )}
        </Col>
      </Row>

      <ConfirmModal
        show={Boolean(pendingInviteDelete)}
        message="Annullare questo invito?"
        onCancel={() => setPendingInviteDelete(null)}
        requireAuthCode
        onConfirm={(authCode) => {
          if (pendingInviteDelete) {
            deleteInviteMutation.mutate({ id: pendingInviteDelete, authCode: authCode || '' });
          }
          setPendingInviteDelete(null);
        }}
      />
    </DashboardLayout>
  );
}
