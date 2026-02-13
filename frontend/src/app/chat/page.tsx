'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import DashboardLayout from '@/components/DashboardLayout';
import { chatApi, familyApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import StatusModal from '@/components/StatusModal';

export default function ChatPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [error, setError] = useState('');

  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: familyApi.get,
    enabled: Boolean(user?.activeFamilyId),
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat', 'messages'],
    queryFn: () => chatApi.listMessages(200),
    enabled: Boolean(user?.activeFamilyId),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ text, recipientId }: { text: string; recipientId?: string }) =>
      chatApi.sendMessage(text, recipientId),
    onSuccess: () => {
      setContent('');
      setRecipientUserId('');
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const sortedMessages = useMemo(() => messages ?? [], [messages]);
  const familyMembers = useMemo(() => family?.users ?? [], [family]);

  return (
    <DashboardLayout>
      <h2 className="page-title mb-4">Chat Famiglia</h2>

      <StatusModal
        show={Boolean(error)}
        variant="danger"
        message={error}
        onClose={() => setError('')}
      />

      <Row className="g-4">
        <Col lg={8}>
          <Card className="settings-card mb-3">
            <Card.Header>Messaggi</Card.Header>
            <Card.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {isLoading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="success" />
                </div>
              ) : sortedMessages.length ? (
                <div className="d-flex flex-column gap-2">
                  {sortedMessages.map((message) => {
                    const isMine = message.senderUserId === user?.id;
                    const isSystem = message.messageType === 'system';
                    const isPrivate = Boolean(message.recipientUserId);

                    return (
                      <div
                        key={message.id}
                        className={`p-2 rounded ${isSystem ? 'bg-light text-muted' : isMine ? 'bg-success-subtle align-self-end' : 'bg-white border'}`}
                        style={{ maxWidth: isSystem ? '100%' : '85%' }}
                      >
                        {!isSystem && (
                          <div className="small fw-semibold d-flex align-items-center gap-2">
                            <span>{isMine ? 'Io' : message.sender?.name || 'Utente'}</span>
                            {isPrivate && (
                              <Badge bg="secondary">
                                Privato
                              </Badge>
                            )}
                            {isPrivate && isMine && message.recipient?.name && (
                              <span className="text-muted">a {message.recipient.name}</span>
                            )}
                          </div>
                        )}
                        <div>{message.content}</div>
                        <div className="small text-muted mt-1">
                          {format(new Date(message.createdAt), 'd MMM yyyy HH:mm', { locale: it })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-muted">Nessun messaggio in chat.</div>
              )}
            </Card.Body>
          </Card>

          <Card className="settings-card">
            <Card.Header>Nuovo Messaggio</Card.Header>
            <Card.Body>
              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = content.trim();
                  if (!trimmed) return;
                  sendMessageMutation.mutate({
                    text: trimmed,
                    recipientId: recipientUserId || undefined,
                  });
                }}
              >
                <Form.Group className="mb-3">
                  <Form.Label>Destinatario</Form.Label>
                  <Form.Select
                    value={recipientUserId}
                    onChange={(e) => setRecipientUserId(e.target.value)}
                  >
                    <option value="">Tutta la famiglia</option>
                    {familyMembers
                      .filter((member) => member.id !== user?.id)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.role === 'admin' ? 'Amministratore' : 'Membro'})
                        </option>
                      ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={recipientUserId ? 'Scrivi un messaggio privato...' : 'Scrivi un messaggio alla famiglia...'}
                    maxLength={2000}
                  />
                </Form.Group>
                <div className="d-flex justify-content-end mt-3">
                  <Button type="submit" variant="primary" disabled={sendMessageMutation.isPending || !content.trim()}>
                    {sendMessageMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Invia'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="settings-card">
            <Card.Header>Membri della Famiglia</Card.Header>
            <Card.Body>
              {familyMembers.length ? (
                <div className="d-flex flex-column gap-2">
                  {familyMembers.map((member) => (
                    <div key={member.id} className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{member.id === user?.id ? 'Io' : member.name}</div>
                        <div className="small text-muted">{member.email}</div>
                      </div>
                      <Badge bg={member.role === 'admin' ? 'success' : 'secondary'}>
                        {member.role === 'admin' ? 'Amministratore' : 'Membro'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted">Nessun membro disponibile.</div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </DashboardLayout>
  );
}
