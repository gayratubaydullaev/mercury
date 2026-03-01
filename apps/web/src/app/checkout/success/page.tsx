import { CheckoutSuccessContent } from './checkout-success-content';

export const metadata = { title: 'Buyurtma qabul qilindi' };

export default function CheckoutSuccessPage() {
  return (
    <div className="px-4 py-8">
      <CheckoutSuccessContent />
    </div>
  );
}
