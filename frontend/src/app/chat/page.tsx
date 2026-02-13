'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [familyContent, setFamilyContent] = useState('');
  const [privateContent, setPrivateContent] = useState('');
  const [selectedPrivateMemberId, setSelectedPrivateMemberId] = useState('');
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

  const sendFamilyMessageMutation = useMutation({
    mutationFn: (text: string) => chatApi.sendMessage(text),
    onSuccess: () => {
      setFamilyContent('');
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const sendPrivateMessageMutation = useMutation({
    mutationFn: ({ text, recipientId }: { text: string; recipientId: string }) =>
      chatApi.sendMessage(text, recipientId),
    onSuccess: () => {
      setPrivateContent('');
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const sortedMessages = useMemo(
    () =>
      [...(messages ?? [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [messages]
  );
  const familyMembers = useMemo(() => family?.users ?? [], [family]);
  const otherMembers = useMemo(
    () => familyMembers.filter((member) => member.id !== user?.id),
    [familyMembers, user?.id]
  );

  useEffect(() => {
    if (!otherMembers.length) {
      setSelectedPrivateMemberId('');
      return;
    }
    if (!selectedPrivateMemberId || !otherMembers.some((member) => member.id === selectedPrivateMemberId)) {
      setSelectedPrivateMemberId(otherMembers[0].id);
    }
  }, [otherMembers, selectedPrivateMemberId]);

  const familyChatMessages = useMemo(
    () => sortedMessages.filter((message) => !message.recipientUserId),
    [sortedMessages]
  );

  const privateThreadMessages = useMemo(
    () =>
      sortedMessages.filter((message) => {
        if (!selectedPrivateMemberId || !message.recipientUserId) return false;
        const me = user?.id;
        return (
          (message.senderUserId === me && message.recipientUserId === selectedPrivateMemberId) ||
          (message.senderUserId === selectedPrivateMemberId && message.recipientUserId === me)
        );
      }),
    [selectedPrivateMemberId, sortedMessages, user?.id]
  );

  const selectedPrivateMember = useMemo(
    () => otherMembers.find((member) => member.id === selectedPrivateMemberId) ?? null,
    [otherMembers, selectedPrivateMemberId]
  );

  return (
    <DashboardLayout>
      <h2 className="page-title mb-4">Chat Famiglia</h2>

      <StatusModal
        show={Boolean(error)}
        variant="danger"
        message={error}
        onClose={() => setError('')}
      />

      <Card className="settings-card mb-4">
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

      <Row className="g-4">
        <Col lg={6}>
          <Card className="settings-card mb-3">
            <Card.Header>Chat Famiglia</Card.Header>
            <Card.Body style={{ maxHeight: '52vh', overflowY: 'auto' }}>
              {isLoading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="success" />
                </div>
              ) : familyChatMessages.length ? (
                <div className="d-flex flex-column gap-2">
                  {familyChatMessages.map((message) => {
                    const isMine = message.senderUserId === user?.id;
                    const isSystem = message.messageType === 'system';

                    return (
                      <div
                        key={message.id}
                        className={`p-2 rounded ${
                          isSystem
                            ? 'bg-light text-muted'
                            : isMine
                              ? 'bg-success-subtle align-self-end'
                              : 'bg-white border'
                        }`}
                        style={{ maxWidth: isSystem ? '100%' : '85%' }}
                      >
                        {!isSystem && (
                          <div className="small fw-semibold">
                            {isMine ? 'Io' : message.sender?.name || 'Utente'}
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
                <div className="text-muted">Nessun messaggio nella chat famiglia.</div>
              )}
            </Card.Body>
          </Card>

          <Card className="settings-card">
            <Card.Header>Nuovo Messaggio Famiglia</Card.Header>
            <Card.Body>
              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = familyContent.trim();
                  if (!trimmed) return;
                  sendFamilyMessageMutation.mutate(trimmed);
                }}
              >
                <Form.Group>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={familyContent}
                    onChange={(e) => setFamilyContent(e.target.value)}
                    placeholder="Scrivi un messaggio alla famiglia..."
                    maxLength={2000}
                  />
                </Form.Group>
                <div className="d-flex justify-content-end mt-3">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={sendFamilyMessageMutation.isPending || !familyContent.trim()}
                  >
                    {sendFamilyMessageMutation.isPending ? (
                      <Spinner size="sm" animation="border" />
                    ) : (
                      'Invia'
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="settings-card mb-3">
            <Card.Header>Chat Privata</Card.Header>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label>Conversazione con</Form.Label>
                <Form.Select
                  value={selectedPrivateMemberId}
                  onChange={(e) => setSelectedPrivateMemberId(e.target.value)}
                  disabled={!otherMembers.length}
                >
                  {!otherMembers.length ? <option value="">Nessun membro disponibile</option> : null}
                  {otherMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.role === 'admin' ? 'Amministratore' : 'Membro'})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                {isLoading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" variant="success" />
                  </div>
                ) : !selectedPrivateMember ? (
                  <div className="text-muted">Seleziona un membro per iniziare una chat privata.</div>
                ) : privateThreadMessages.length ? (
                  <div className="d-flex flex-column gap-2">
                    {privateThreadMessages.map((message) => {
                      const isMine = message.senderUserId === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={`p-2 rounded ${isMine ? 'bg-success-subtle align-self-end' : 'bg-white border'}`}
                          style={{ maxWidth: '85%' }}
                        >
                          <div className="small fw-semibold">
                            {isMine ? 'Io' : message.sender?.name || 'Utente'}
                          </div>
                          <div>{message.content}</div>
                          <div className="small text-muted mt-1">
                            {format(new Date(message.createdAt), 'd MMM yyyy HH:mm', { locale: it })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-muted">Nessun messaggio privato con questo membro.</div>
                )}
              </div>
            </Card.Body>
          </Card>

          <Card className="settings-card">
            <Card.Header>Nuovo Messaggio Privato</Card.Header>
            <Card.Body>
              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = privateContent.trim();
                  if (!trimmed || !selectedPrivateMemberId) return;
                  sendPrivateMessageMutation.mutate({
                    text: trimmed,
                    recipientId: selectedPrivateMemberId,
                  });
                }}
              >
                <Form.Group>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={privateContent}
                    onChange={(e) => setPrivateContent(e.target.value)}
                    placeholder={
                      selectedPrivateMember
                        ? `Scrivi un messaggio privato a ${selectedPrivateMember.name}...`
                        : 'Seleziona prima un membro...'
                    }
                    maxLength={2000}
                    disabled={!selectedPrivateMember}
                  />
                </Form.Group>
                <div className="d-flex justify-content-end mt-3">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={
                      sendPrivateMessageMutation.isPending ||
                      !privateContent.trim() ||
                      !selectedPrivateMember
                    }
                  >
                    {sendPrivateMessageMutation.isPending ? (
                      <Spinner size="sm" animation="border" />
                    ) : (
                      'Invia'
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </DashboardLayout>
  );
}
