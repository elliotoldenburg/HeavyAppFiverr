export interface StripeProduct {
  priceId: string;
  name: string;
  description: string;
  mode: 'subscription' | 'payment';
}

export const PRODUCTS: StripeProduct[] = [
  {
    priceId: 'price_1RIIyuD8RYjZLT9Q3KqUcQHm',
    name: 'Heavy Gym App',
    description: 'Prenumeration på fitness app',
    mode: 'subscription',
  },
];