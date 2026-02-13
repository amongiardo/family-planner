'use client';

import { Navbar as BsNavbar, Container, Nav, NavDropdown, Image } from 'react-bootstrap';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { familyApi } from '@/lib/api';

export default function Navbar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout, refresh } = useAuth();

  const activeFamily = user?.families?.find((family) => family.id === user.activeFamilyId);
  const homeHref = user?.activeFamilyId ? '/dashboard' : '/impostazioni';

  const handleSwitchFamily = async (familyId: string) => {
    if (!user || familyId === user.activeFamilyId) return;
    await familyApi.switchActive(familyId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('activeFamilyId', familyId);
    }
    queryClient.clear();
    await refresh();
    router.refresh();
  };

  return (
    <BsNavbar expand="lg" className="app-navbar shadow-sm">
      <Container fluid>
        <Link href={homeHref} passHref legacyBehavior>
          <BsNavbar.Brand className="d-flex align-items-center gap-2">
            <span style={{ fontSize: 18 }}>🍽️</span>
            Family Planner
          </BsNavbar.Brand>
        </Link>

        <BsNavbar.Toggle aria-controls="navbar-nav" />

        <BsNavbar.Collapse id="navbar-nav" className="justify-content-end">
          <Nav>
            {user?.families && user.families.length > 0 && (
              <NavDropdown
                title={`Famiglia: ${activeFamily?.name ?? user.families[0].name}`}
                id="family-dropdown"
                align="end"
              >
                {user.families.map((family) => (
                  <NavDropdown.Item
                    key={family.id}
                    active={family.id === user.activeFamilyId}
                    onClick={() => handleSwitchFamily(family.id)}
                  >
                    {family.name} ({family.role === 'admin' ? 'Admin' : 'Member'})
                  </NavDropdown.Item>
                ))}
              </NavDropdown>
            )}
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
