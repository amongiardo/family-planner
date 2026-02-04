'use client';

import { useState } from 'react';
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

export default function ImpostazioniPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [familyName, setFamilyName] = useState('');
  const [familyCity, setFamilyCity] = useState('Roma');
  const [inviteEmail, setInviteEmail] = useState('');
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingInviteDelete, setPendingInviteDelete] = useState<string | null>(null);

  const { data: family, isLoading } = useQuery({
    queryKey: ['family'],
    queryFn: familyApi.get,
    onSuccess: (data) => {
      if (data && !familyName) {
        setFamilyName(data.name);
      }
      if (data?.city) {
        setFamilyCity(data.city);
      }
    },
  });

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: ['invites'],
    queryFn: familyApi.getInvites,
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
    mutationFn: familyApi.deleteInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });

  const handleUpdateFamily = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (familyName.trim() || familyCity.trim()) {
      updateFamilyMutation.mutate({ name: familyName.trim(), city: familyCity.trim() });
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
              <Form onSubmit={handleUpdateFamily}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome Famiglia</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder="Nome della famiglia"
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
                      placeholder="Roma"
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
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>Membri della Famiglia</Card.Header>
            <ListGroup variant="flush">
              {family?.users.map((member) => (
                <ListGroup.Item key={member.id} className="d-flex align-items-center gap-3">
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
                  <div>
                    <div className="fw-medium">
                      {member.name}
                      {member.id === user?.id && (
                        <Badge bg="secondary" className="ms-2">
                          Tu
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
                      placeholder="email@esempio.com"
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

          <Card>
            <Card.Header>Inviti Pendenti</Card.Header>
            {invitesLoading ? (
              <Card.Body className="text-center">
                <Spinner size="sm" animation="border" variant="success" />
              </Card.Body>
            ) : invites && invites.length > 0 ? (
              <ListGroup variant="flush">
                {invites.map((invite) => (
                  <ListGroup.Item key={invite.id}>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-medium">{invite.email}</div>
                        <small className="text-muted">
                          Scade il{' '}
                          {format(parseISO(invite.expiresAt), 'd MMM yyyy', { locale: it })}
                        </small>
                      </div>
                      <div>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="me-1"
                          onClick={() =>
                            handleCopyInvite(
                              `${window.location.origin}/invite/${invite.id}`,
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
        </Col>
      </Row>

      <ConfirmModal
        show={Boolean(pendingInviteDelete)}
        message="Annullare questo invito?"
        onCancel={() => setPendingInviteDelete(null)}
        onConfirm={() => {
          if (pendingInviteDelete) {
            deleteInviteMutation.mutate(pendingInviteDelete);
          }
          setPendingInviteDelete(null);
        }}
      />
    </DashboardLayout>
  );
}
