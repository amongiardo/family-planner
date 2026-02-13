'use client';

import { useMemo, useState } from 'react';
import { Button, Card, Form, Spinner } from 'react-bootstrap';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import DashboardLayout from '@/components/DashboardLayout';
import { chatApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import StatusModal from '@/components/StatusModal';

export default function ChatPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat', 'messages'],
    queryFn: () => chatApi.listMessages(200),
    enabled: Boolean(user?.activeFamilyId),
    refetchInterval: 5000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (text: string) => chatApi.sendMessage(text),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const sortedMessages = useMemo(() => messages ?? [], [messages]);

  return (
    <DashboardLayout>
      <h2 className="page-title mb-4">Chat Famiglia</h2>

      <StatusModal
        show={Boolean(error)}
        variant="danger"
        message={error}
        onClose={() => setError('')}
      />

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

                return (
                  <div
                    key={message.id}
                    className={`p-2 rounded ${isSystem ? 'bg-light text-muted' : isMine ? 'bg-success-subtle align-self-end' : 'bg-white border'}`}
                    style={{ maxWidth: isSystem ? '100%' : '80%' }}
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
              sendMessageMutation.mutate(trimmed);
            }}
          >
            <Form.Group>
              <Form.Control
                as="textarea"
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Scrivi un messaggio alla famiglia..."
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
    </DashboardLayout>
  );
}
