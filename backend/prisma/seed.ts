import { PrismaClient, DishCategory } from '@prisma/client';

const prisma = new PrismaClient();

const sampleDishes = [
  // Primi
  { name: 'Pasta al pomodoro', category: 'primo' as DishCategory, ingredients: ['pasta', 'pomodori', 'basilico', 'olio', 'aglio'] },
  { name: 'Risotto ai funghi', category: 'primo' as DishCategory, ingredients: ['riso', 'funghi', 'cipolla', 'brodo', 'parmigiano'] },
  { name: 'Lasagne', category: 'primo' as DishCategory, ingredients: ['lasagne', 'ragù', 'besciamella', 'parmigiano'] },
  { name: 'Spaghetti alla carbonara', category: 'primo' as DishCategory, ingredients: ['spaghetti', 'guanciale', 'uova', 'pecorino', 'pepe'] },
  { name: 'Penne all\'arrabbiata', category: 'primo' as DishCategory, ingredients: ['penne', 'pomodori', 'peperoncino', 'aglio', 'prezzemolo'] },
  { name: 'Gnocchi al pesto', category: 'primo' as DishCategory, ingredients: ['gnocchi', 'basilico', 'pinoli', 'parmigiano', 'aglio'] },
  { name: 'Minestrone', category: 'primo' as DishCategory, ingredients: ['fagioli', 'carote', 'sedano', 'patate', 'zucchine', 'pomodori'] },

  // Secondi
  { name: 'Pollo arrosto', category: 'secondo' as DishCategory, ingredients: ['pollo', 'rosmarino', 'aglio', 'olio', 'limone'] },
  { name: 'Cotoletta di pollo', category: 'secondo' as DishCategory, ingredients: ['petto di pollo', 'uova', 'pangrattato', 'farina'] },
  { name: 'Filetto di salmone', category: 'secondo' as DishCategory, ingredients: ['salmone', 'limone', 'aneto', 'olio'] },
  { name: 'Bistecca alla griglia', category: 'secondo' as DishCategory, ingredients: ['bistecca', 'rosmarino', 'olio', 'sale'] },
  { name: 'Polpette al sugo', category: 'secondo' as DishCategory, ingredients: ['carne macinata', 'uova', 'pangrattato', 'pomodori'] },
  { name: 'Frittata di verdure', category: 'secondo' as DishCategory, ingredients: ['uova', 'zucchine', 'cipolla', 'parmigiano'] },
  { name: 'Merluzzo al forno', category: 'secondo' as DishCategory, ingredients: ['merluzzo', 'pomodorini', 'olive', 'capperi'] },

  // Contorni
  { name: 'Insalata mista', category: 'contorno' as DishCategory, ingredients: ['lattuga', 'pomodori', 'carote', 'olio', 'aceto'] },
  { name: 'Patate al forno', category: 'contorno' as DishCategory, ingredients: ['patate', 'rosmarino', 'olio', 'aglio'] },
  { name: 'Verdure grigliate', category: 'contorno' as DishCategory, ingredients: ['zucchine', 'melanzane', 'peperoni', 'olio'] },
  { name: 'Spinaci saltati', category: 'contorno' as DishCategory, ingredients: ['spinaci', 'aglio', 'olio', 'peperoncino'] },
  { name: 'Fagiolini al vapore', category: 'contorno' as DishCategory, ingredients: ['fagiolini', 'olio', 'limone'] },
  { name: 'Broccoli al vapore', category: 'contorno' as DishCategory, ingredients: ['broccoli', 'olio', 'limone', 'aglio'] },
  { name: 'Caponata', category: 'contorno' as DishCategory, ingredients: ['melanzane', 'pomodori', 'sedano', 'olive', 'capperi'] },
];

async function main() {
  console.log('Seeding database...');

  // Create a demo family
  const family = await prisma.family.create({
    data: {
      name: 'Famiglia Demo',
    },
  });

  console.log(`Created family: ${family.name}`);

  // Create dishes for the family
  for (const dish of sampleDishes) {
    await prisma.dish.create({
      data: {
        familyId: family.id,
        ...dish,
      },
    });
  }

  console.log(`Created ${sampleDishes.length} dishes`);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
