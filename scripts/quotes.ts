export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  {
    text: "Programs must be written for people to read, and only incidentally for machines to execute.",
    author: "Harold Abelson",
  },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { text: "Premature optimization is the root of all evil.", author: "Donald Knuth" },
  { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House" },
  { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  {
    text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
    author: "Martin Fowler",
  },
  {
    text: "There are only two hard things in Computer Science: cache invalidation and naming things.",
    author: "Phil Karlton",
  },
  { text: "Weeks of coding can save you hours of planning.", author: "Unknown" },
  { text: "Testing leads to failure, and failure leads to understanding.", author: "Burt Rutan" },
  { text: "Before software can be reusable it first has to be usable.", author: "Ralph Johnson" },
  {
    text: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.",
    author: "Antoine de Saint-Exupéry",
  },
  { text: "Programming isn't about what you know; it's about what you can figure out.", author: "Chris Pine" },
  { text: "Deleted code is debugged code.", author: "Jeff Sickel" },
  { text: "Software is a great combination between artistry and engineering.", author: "Bill Gates" },
  { text: "It works on my machine.", author: "every developer, at some point" },
];

/** Gün bazında deterministik seçim — aynı gün içinde kart değişmez, ertesi gün yenisi gelir */
export function pickQuote(now: Date): Quote {
  const epochDay = Math.floor(now.getTime() / 86_400_000);
  return QUOTES[epochDay % QUOTES.length];
}
