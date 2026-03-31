const KEYWORD_MAP: Record<string, string[]> = {
  Italian: [
    "pasta",
    "pizza",
    "risotto",
    "lasagna",
    "tiramisu",
    "carbonara",
    "fettuccine",
    "spaghetti",
    "ravioli",
    "penne",
    "gnocchi",
    "focaccia",
    "bruschetta",
    "minestrone",
    "osso buco",
    "bolognese",
    "alfredo",
    "linguine",
    "cannelloni",
    "calzone",
  ],
  Mexican: [
    "taco",
    "burrito",
    "enchilada",
    "quesadilla",
    "guacamole",
    "tamale",
    "salsa",
    "nachos",
    "fajita",
    "carnitas",
    "mole",
    "pozole",
    "elote",
    "chilaquiles",
    "huevos",
  ],
  Asian: [
    "ramen",
    "sushi",
    "stir fry",
    "stir-fry",
    "noodle",
    "fried rice",
    "dim sum",
    "pho",
    "dumpling",
    "teriyaki",
    "miso",
    "pad thai",
    "wonton",
    "bibimbap",
    "tempura",
    "bao",
    "lo mein",
    "chow mein",
    "udon",
    "soba",
    "spring roll",
  ],
  Indian: [
    "curry",
    "tikka",
    "masala",
    "biryani",
    "naan",
    "samosa",
    "dal",
    "palak",
    "korma",
    "vindaloo",
    "chana",
    "paneer",
    "dosa",
    "tandoori",
    "aloo",
    "saag",
    "rajma",
    "idli",
    "vada",
  ],
  Mediterranean: [
    "hummus",
    "falafel",
    "shawarma",
    "kebab",
    "gyros",
    "gyro",
    "baklava",
    "tzatziki",
    "pita",
    "couscous",
    "tabouleh",
    "muhammara",
    "baba ganoush",
    "dolma",
    "moussaka",
    "shakshuka",
  ],
  American: [
    "burger",
    "hot dog",
    "bbq",
    "barbecue",
    "chili",
    "mac and cheese",
    "fried chicken",
    "grilled cheese",
    "sandwich",
    "meatloaf",
    "biscuit",
    "gravy",
    "pot roast",
    "clam chowder",
    "buffalo",
    "cornbread",
  ],
};

export function classifyCuisine(mealName: string): string {
  const lower = mealName.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [cuisine, keywords] of Object.entries(KEYWORD_MAP)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += 1;
      }
    }
    if (score > 0) {
      scores[cuisine] = score;
    }
  }

  if (Object.keys(scores).length === 0) {
    return "Other";
  }

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}
