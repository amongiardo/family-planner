'use client';

import { useEffect, useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

interface ConfirmModalProps {
  show: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireAuthCode?: boolean;
  onConfirm: (authCode?: string) => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  show,
  title = 'Conferma',
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  requireAuthCode = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [authCode, setAuthCode] = useState('');

  useEffect(() => {
    if (!show) {
      setAuthCode('');
    }
  }, [show]);

  const normalizedCode = authCode.trim().toUpperCase();
  const codeValid = /^[A-Z0-9]{5}$/.test(normalizedCode);

  return (
    <Modal show={show} onHide={onCancel} centered dialogClassName="app-modal">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div>{message}</div>
        {requireAuthCode && (
          <Form.Group className="mt-3" controlId="familyAuthCode">
            <Form.Label>Codice di autenticazione</Form.Label>
            <Form.Control
              type="text"
              inputMode="text"
              autoComplete="off"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              placeholder="es: A1B2C"
              maxLength={5}
            />
            <Form.Text className="text-muted">
              Inserisci il codice a 5 caratteri per confermare.
            </Form.Text>
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-primary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          onClick={() => onConfirm(requireAuthCode ? normalizedCode : undefined)}
          disabled={requireAuthCode ? !codeValid : false}
        >
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
