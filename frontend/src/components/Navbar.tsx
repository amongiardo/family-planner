'use client';

import { Navbar as BsNavbar, Container, Nav, NavDropdown, Image } from 'react-bootstrap';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <BsNavbar expand="lg" className="app-navbar shadow-sm">
      <Container fluid>
        <Link href="/dashboard" passHref legacyBehavior>
          <BsNavbar.Brand className="d-flex align-items-center gap-2">
            <span style={{ fontSize: 18 }}>🍽️</span>
            Family Planner
          </BsNavbar.Brand>
        </Link>

        <BsNavbar.Toggle aria-controls="navbar-nav" />

        <BsNavbar.Collapse id="navbar-nav" className="justify-content-end">
          <Nav>
            {user && (
              <NavDropdown
                title={
                  <span className="d-inline-flex align-items-center gap-2 user-dropdown-title">
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        roundedCircle
                        width={28}
                        height={28}
                        alt={user.name}
                      />
                    ) : (
                      <div
                        className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                        style={{ width: 28, height: 28, fontSize: 12 }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="user-dropdown-name">{user.name}</span>
                  </span>
                }
                id="user-dropdown"
                align="end"
              >
                <Link href="/impostazioni" passHref legacyBehavior>
                  <NavDropdown.Item>Impostazioni</NavDropdown.Item>
                </Link>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={logout}>Esci</NavDropdown.Item>
              </NavDropdown>
            )}
          </Nav>
        </BsNavbar.Collapse>
      </Container>
    </BsNavbar>
  );
}
