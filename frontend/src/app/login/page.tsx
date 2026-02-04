'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Alert, Form } from 'react-bootstrap';
import { FaGoogle, FaGithub } from 'react-icons/fa';
import { useAuth } from '@/lib/AuthContext';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, refresh } = useAuth();
  const error = searchParams.get('error');
  const inviteToken = searchParams.get('invite') || undefined;
  const [mode, setMode] = useState<'login' | 'register'>(inviteToken ? 'register' : 'login');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', password: '', name: '' });

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleGoogleLogin = () => {
    window.location.href = authApi.getGoogleLoginUrl();
  };

  const handleGithubLogin = () => {
    window.location.href = authApi.getGithubLoginUrl();
  };

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    try {
      if (mode === 'login') {
        await authApi.loginLocal({ email: form.email, password: form.password });
      } else {
        await authApi.registerLocal({
          email: form.email,
          password: form.password,
          name: form.name,
          inviteToken,
        });
      }
      await refresh();
      router.push('/dashboard');
    } catch (err: any) {
      setLocalError(err?.message || 'Autenticazione fallita');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="login-page">
      <div className="login-card text-center">
        <h1 className="mb-2 login-title">Family Meal Planner</h1>
        <p className="text-muted mb-4">Pianifica i pasti della tua famiglia</p>

        {error && (
          <Alert variant="danger" className="mb-4">
            Autenticazione fallita. Riprova.
          </Alert>
        )}

        {localError && (
          <Alert variant="danger" className="mb-4">
            {localError}
          </Alert>
        )}

        <div className="d-grid gap-3">
          <Button
            variant="outline-primary"
            size="lg"
            onClick={handleGoogleLogin}
            className="d-flex align-items-center justify-content-center gap-2"
          >
            <FaGoogle /> Accedi con Google
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={handleGithubLogin}
            className="d-flex align-items-center justify-content-center gap-2"
          >
            <FaGithub /> Accedi con GitHub
          </Button>
        </div>

        <div className="my-4 text-muted">oppure</div>

        <Form onSubmit={handleLocalSubmit} className="text-start">
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              placeholder="nome@dominio.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Form.Group>

          {mode === 'register' && (
            <Form.Group className="mb-3" controlId="name">
              <Form.Label>Nome</Form.Label>
              <Form.Control
                type="text"
                placeholder="Il tuo nome"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Form.Group>
          )}

          <Form.Group className="mb-3" controlId="password">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </Form.Group>

          <div className="d-grid">
            <Button variant="primary" type="submit" disabled={submitting}>
              {mode === 'login' ? 'Accedi con Email' : 'Crea Account'}
            </Button>
          </div>

          <div className="mt-3 text-center small">
            {mode === 'login' ? (
              <button
                type="button"
                className="btn btn-link p-0"
                onClick={() => setMode('register')}
              >
                Non hai un account? Registrati
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-link p-0"
                onClick={() => setMode('login')}
              >
                Hai già un account? Accedi
              </button>
            )}
          </div>
        </Form>

        <p className="mt-4 text-muted small">
          Accedendo, accetti i nostri termini di servizio
        </p>
      </div>
    </div>
  );
}
