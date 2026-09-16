export const DEMO_CATEGORIES = ["Coffee", "Snacks", "Desserts", "Coolers"];

const U = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

export const DEMO_ITEMS = [
  { cat: "Coffee", name: "Espresso Shot", description: "Bold single-origin shot, thick crema", price: 9900, imageEmoji: "☕", img: U("photo-1510591509098-f4fdc6d0ff04"), veg: true, popular: true },
  { cat: "Coffee", name: "Cappuccino", description: "Double shot, velvety milk foam", price: 14900, imageEmoji: "☕", img: U("photo-1572442388796-11668a67e53d"), veg: true, popular: true },
  { cat: "Coffee", name: "Cold Brew Tonic", description: "18-hr steep, citrus tonic, ice", price: 17900, imageEmoji: "🧊", img: U("photo-1517701604599-bb29b565090c"), veg: true, popular: false },
  { cat: "Coffee", name: "Hazelnut Latte", description: "Espresso, hazelnut, steamed milk", price: 16900, imageEmoji: "🥛", img: U("photo-1541167760496-1628856ab772"), veg: true, popular: true },
  { cat: "Snacks", name: "Peri-Peri Fries", description: "Crispy fries, peri-peri dust", price: 12900, imageEmoji: "🍟", img: U("photo-1573080496219-bb080dd4f877"), veg: true, popular: true },
  { cat: "Snacks", name: "Paneer Tikka Sandwich", description: "Smoky paneer, mint mayo, grilled", price: 15900, imageEmoji: "🥪", img: U("photo-1528735602780-2552fd46c7af"), veg: true, popular: false },
  { cat: "Snacks", name: "Chicken Keema Pav", description: "Mumbai style keema, butter pav", price: 18900, imageEmoji: "🍗", img: U("photo-1568901346375-23c9450c58cd"), veg: false, popular: true },
  { cat: "Desserts", name: "Chocolate Truffle Jar", description: "Dark chocolate, sea salt", price: 13900, imageEmoji: "🍫", img: U("photo-1551024506-0bccd828d307"), veg: true, popular: true },
  { cat: "Desserts", name: "Basque Cheesecake", description: "Burnt top, gooey centre", price: 19900, imageEmoji: "🍰", img: U("photo-1533134242443-d4fd215305ad"), veg: true, popular: false },
  { cat: "Coolers", name: "Virgin Mint Mojito", description: "Mint, lime, soda over crushed ice", price: 11900, imageEmoji: "🍹", img: U("photo-1551538827-9c037cb4f32a"), veg: true, popular: false },
  { cat: "Coolers", name: "Mango Smoothie", description: "Alphonso, yogurt, honey", price: 14900, imageEmoji: "🥭", img: U("photo-1623065422902-30a2d299bbe4"), veg: true, popular: true },
];
