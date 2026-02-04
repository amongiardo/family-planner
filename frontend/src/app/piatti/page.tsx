'use client';

import { useState, useRef } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Form,
  Modal,
  Badge,
  ListGroup,
  InputGroup,
  Spinner,
  Alert,
} from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaTimes } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { dishesApi } from '@/lib/api';
import { Dish, DishCategory } from '@/types';

const categoryLabels: Record<DishCategory, string> = {
  primo: 'Primo',
  secondo: 'Secondo',
  contorno: 'Contorno',
};

export default function PiattiPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'primo' as DishCategory,
    ingredients: [] as string[],
  });
  const [newIngredient, setNewIngredient] = useState('');
  const [error, setError] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: dishes, isLoading } = useQuery({
    queryKey: ['dishes', categoryFilter, search],
    queryFn: () =>
      dishesApi.list({
        category: categoryFilter || undefined,
        search: search || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: dishesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      handleCloseModal();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof dishesApi.update>[1] }) =>
      dishesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      handleCloseModal();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: dishesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: dishesApi.deleteAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      setImportStatus('Tutti i piatti e le pianificazioni correlate sono stati rimossi.');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleOpenModal = (dish?: Dish) => {
    if (dish) {
      setEditingDish(dish);
      setFormData({
        name: dish.name,
        category: dish.category,
        ingredients: [...dish.ingredients],
      });
    } else {
      setEditingDish(null);
      setFormData({
        name: '',
        category: 'primo',
        ingredients: [],
      });
    }
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDish(null);
    setNewIngredient('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Il nome del piatto è obbligatorio');
      return;
    }

    if (editingDish) {
      updateMutation.mutate({ id: editingDish.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAddIngredient = () => {
    if (newIngredient.trim()) {
      setFormData({
        ...formData,
        ingredients: [...formData.ingredients, newIngredient.trim()],
      });
      setNewIngredient('');
    }
  };

  const handleRemoveIngredient = (index: number) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index),
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo piatto?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDeleteAll = () => {
    if (confirm('Eliminare tutti i piatti e le pianificazioni collegate?')) {
      deleteAllMutation.mutate();
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'primo':
        return 'badge-primo';
      case 'secondo':
        return 'badge-secondo';
      case 'contorno':
        return 'badge-contorno';
      default:
        return 'bg-secondary';
    }
  };

  const parseCsvLine = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return [];
    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const nameIndex = headers.indexOf('name');
    const categoryIndex = headers.indexOf('category');
    const ingredientsIndex = headers.indexOf('ingredients');

    if (nameIndex === -1 || categoryIndex === -1 || ingredientsIndex === -1) {
      throw new Error('CSV non valido. Usa intestazioni: name, category, ingredients');
    }

    return lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      const name = cols[nameIndex]?.trim();
      const categoryRaw = cols[categoryIndex]?.trim().toLowerCase();
      const ingredientsRaw = cols[ingredientsIndex] ?? '';
      const ingredients = ingredientsRaw
        .split(';')
        .map((ing) => ing.trim())
        .filter(Boolean);

      if (!name) {
        throw new Error('CSV non valido: riga con nome mancante');
      }

      if (!['primo', 'secondo', 'contorno'].includes(categoryRaw)) {
        throw new Error(`Categoria non valida: ${categoryRaw}`);
      }

      return { name, category: categoryRaw as DishCategory, ingredients };
    });
  };

  const handleImportCsv = async (file: File) => {
    setError('');
    setImportStatus(null);
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);

      let created = 0;
      let failed = 0;
      for (const dish of parsed) {
        try {
          await dishesApi.create(dish);
          created += 1;
        } catch (err) {
          failed += 1;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      setImportStatus(`Import completato: ${created} creati, ${failed} falliti.`);
    } catch (err: any) {
      setError(err?.message || 'Errore durante l’import CSV');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title">Gestione Piatti</h2>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline-primary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? <Spinner size="sm" animation="border" /> : 'Importa CSV'}
          </Button>
          <Button variant="outline-danger" onClick={handleDeleteAll} disabled={deleteAllMutation.isPending}>
            {deleteAllMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Cancella Tutti'}
          </Button>
          <Button variant="primary" onClick={() => handleOpenModal()}>
            <FaPlus className="me-2" /> Nuovo Piatto
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="d-none"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportCsv(file);
          }
        }}
      />

      <Card className="mb-4">
        <Card.Body>
          <Row>
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Cerca piatti..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={4}>
              <Form.Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">Tutte le categorie</option>
                <option value="primo">Primi</option>
                <option value="secondo">Secondi</option>
                <option value="contorno">Contorni</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {importStatus && (
        <Alert variant="success" dismissible onClose={() => setImportStatus(null)}>
          {importStatus}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
        </div>
      ) : dishes && dishes.length > 0 ? (
        <Row>
          {dishes.map((dish) => (
            <Col md={6} lg={4} key={dish.id} className="mb-4">
              <Card className="h-100 dish-card">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <Badge className={getCategoryBadgeClass(dish.category)}>
                        {categoryLabels[dish.category]}
                      </Badge>
                    </div>
                    <div>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 me-2"
                        onClick={() => handleOpenModal(dish)}
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-danger"
                        onClick={() => handleDelete(dish.id)}
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  </div>
                  <Card.Title>{dish.name}</Card.Title>
                  {dish.ingredients.length > 0 && (
                    <div className="mt-2">
                      {dish.ingredients.map((ing, i) => (
                        <span key={i} className="ingredient-tag">
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card>
          <Card.Body className="text-center py-5">
            <p className="text-muted mb-3">Nessun piatto trovato</p>
            <Button variant="primary" onClick={() => handleOpenModal()}>
              <FaPlus className="me-2" /> Aggiungi il tuo primo piatto
            </Button>
          </Card.Body>
        </Card>
      )}

      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>{editingDish ? 'Modifica Piatto' : 'Nuovo Piatto'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>Nome</Form.Label>
              <Form.Control
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="es. Pasta al pomodoro"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Categoria</Form.Label>
              <Form.Select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as DishCategory })
                }
              >
                <option value="primo">Primo</option>
                <option value="secondo">Secondo</option>
                <option value="contorno">Contorno</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Ingredienti</Form.Label>
              <InputGroup className="mb-2">
                <Form.Control
                  type="text"
                  value={newIngredient}
                  onChange={(e) => setNewIngredient(e.target.value)}
                  placeholder="Aggiungi ingrediente"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddIngredient();
                    }
                  }}
                />
                <Button variant="outline-secondary" onClick={handleAddIngredient}>
                  <FaPlus />
                </Button>
              </InputGroup>
              <div>
                {formData.ingredients.map((ing, i) => (
                  <span key={i} className="ingredient-tag d-inline-flex align-items-center">
                    {ing}
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 ms-1 text-danger"
                      onClick={() => handleRemoveIngredient(i)}
                    >
                      <FaTimes size={12} />
                    </Button>
                  </span>
                ))}
              </div>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Annulla
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Spinner size="sm" animation="border" />
              ) : editingDish ? (
                'Salva Modifiche'
              ) : (
                'Crea Piatto'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </DashboardLayout>
  );
}
