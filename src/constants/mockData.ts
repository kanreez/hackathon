export type Item = {
    id: string;
    title: string;
    description: string;
    price: number;
    category: "food" | "tech" | "travel" | "fitness";
    image: string;
    rating: number;
    latitude?: number | null; // optional: items without a location are listed last in "Nearby"
    longitude?: number | null;
    user_id?: string; // set when stored in Supabase
    created_at?: string;
  };

  // Used by the category chips on Explore and the form. Rename on the day.
  export const CATEGORIES: { value: Item["category"]; label: string }[] = [
    { value: "food", label: "Food" },
    { value: "tech", label: "Tech" },
    { value: "travel", label: "Travel" },
    { value: "fitness", label: "Fitness" },
  ];

  export const mockItems: Item[] = [
    { id: "1", title: "Sourdough Bakery", description: "Fresh bread baked every morning.", price: 6, category: "food", image: "https://picsum.photos/seed/bread/400/300", rating: 4.8, latitude: 42.1928, longitude: 24.3336 },
    { id: "2", title: "Wireless Headphones", description: "Noise cancelling, 30h battery.", price: 89, category: "tech", image: "https://picsum.photos/seed/audio/400/300", rating: 4.5, latitude: 42.1935, longitude: 24.3341 },
    { id: "3", title: "Rila Day Trip", description: "Guided tour to the monastery.", price: 45, category: "travel", image: "https://picsum.photos/seed/rila/400/300", rating: 4.9, latitude: 42.1331, longitude: 23.3403 },
    { id: "4", title: "Yoga Class", description: "60-minute beginner session.", price: 12, category: "fitness", image: "https://picsum.photos/seed/yoga/400/300", rating: 4.7, latitude: 42.1902, longitude: 24.3318 },
    { id: "5", title: "Smart Watch", description: "Heart rate and sleep tracking.", price: 129, category: "tech", image: "https://picsum.photos/seed/watch/400/300", rating: 4.3, latitude: 42.1944, longitude: 24.3362 },
    { id: "6", title: "Street Food Tour", description: "Taste local specialties.", price: 25, category: "food", image: "https://picsum.photos/seed/street/400/300", rating: 4.6, latitude: 42.1917, longitude: 24.3305 },
    { id: "7", title: "City Bike Rental", description: "Per day, helmet included.", price: 10, category: "fitness", image: "https://picsum.photos/seed/bike/400/300", rating: 4.4, latitude: 42.1951, longitude: 24.3329 },
    { id: "8", title: "Mountain Cabin", description: "Weekend stay for two.", price: 110, category: "travel", image: "https://picsum.photos/seed/cabin/400/300", rating: 4.9, latitude: 42.0, longitude: 24.2 },
  ];
  
  export const mockUser = {
    id: "demo-user",
    email: "demo@app.com",
    full_name: "Demo User",
    avatar_url: "https://picsum.photos/seed/avatar/200",
  };