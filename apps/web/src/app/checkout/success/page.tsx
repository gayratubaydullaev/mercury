import { CheckoutSuccessContent } from './checkout-success-content';

export const metadata = { title: 'Buyurtma qabul qilindi' };

export default function CheckoutSuccessPage() {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <CheckoutSuccessContent />
    </div>
  );
}
