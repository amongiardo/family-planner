'use client';

import { Navbar as BsNavbar, Container, Nav, NavDropdown, Image } from 'react-bootstrap';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { FaUtensils } from 'react-icons/fa';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <BsNavbar bg="white" expand="lg" className="shadow-sm">
      <Container fluid>
        <Link href="/dashboard" passHref legacyBehavior>
          <BsNavbar.Brand className="d-flex align-items-center gap-2">
            <FaUtensils color="#2c7a51" />
            Family Meal Planner
          </BsNavbar.Brand>
        </Link>

        <BsNavbar.Toggle aria-controls="navbar-nav" />

        <BsNavbar.Collapse id="navbar-nav" className="justify-content-end">
          <Nav>
            {user && (
              <NavDropdown
                title={
                  <span className="d-flex align-items-center gap-2">
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
                    {user.name}
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
