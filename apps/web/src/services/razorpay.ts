import { apiRequest } from './api';
import {
  CreateRazorpayOrderRequest,
  RazorpayOrderResponse,
  VerifyRazorpayPaymentRequest,
  VerifyRazorpayPaymentResponse,
} from '@aescion/types';

/**
 * Dynamically load the official Razorpay Checkout SDK script.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      console.error('Failed to load Razorpay Checkout script.');
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

/**
 * Request server-authenticated Razorpay Order creation for an invoice.
 */
export async function createRazorpayOrder(
  request: CreateRazorpayOrderRequest,
): Promise<RazorpayOrderResponse> {
  return apiRequest<RazorpayOrderResponse>('/payments/razorpay/create-order', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Verify cryptographic signature with server and capture the payment transactionally.
 */
export async function verifyRazorpayPayment(
  request: VerifyRazorpayPaymentRequest,
): Promise<VerifyRazorpayPaymentResponse> {
  return apiRequest<VerifyRazorpayPaymentResponse>('/payments/razorpay/verify', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export interface LaunchCheckoutOptions {
  orderData: RazorpayOrderResponse;
  onSuccess: (verifiedResult: VerifyRazorpayPaymentResponse) => void;
  onError: (error: any) => void;
  onDismiss?: () => void;
}

/**
 * Launch the native Razorpay Standard Checkout modal.
 */
export async function launchRazorpayCheckout({
  orderData,
  onSuccess,
  onError,
  onDismiss,
}: LaunchCheckoutOptions): Promise<void> {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    throw new Error('Could not load Razorpay SDK. Please check your internet connection.');
  }

  const RazorpayCheckout = (window as any).Razorpay;
  if (!RazorpayCheckout) {
    throw new Error('Razorpay SDK is unavailable on window object.');
  }

  const options = {
    key: orderData.keyId,
    amount: orderData.amountInPaise,
    currency: orderData.currency || 'INR',
    name: orderData.businessName || 'AESCION Billing',
    description: `Payment for Invoice ${orderData.invoiceNumber}`,
    image: orderData.businessLogo || undefined,
    order_id: orderData.orderId,
    handler: async (response: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      try {
        const verifiedResult = await verifyRazorpayPayment({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
        onSuccess(verifiedResult);
      } catch (err: any) {
        console.error('Signature verification failed:', err);
        onError(err);
      }
    },
    prefill: {
      name: orderData.customerName || '',
      email: orderData.customerEmail || '',
      contact: orderData.customerPhone || '',
    },
    notes: {
      invoiceId: orderData.invoiceId,
      invoiceNumber: orderData.invoiceNumber,
    },
    theme: {
      color: '#2563EB', // AESCION brand blue
    },
    modal: {
      ondismiss: () => {
        if (onDismiss) {
          onDismiss();
        }
      },
    },
  };

  const rzp = new RazorpayCheckout(options);

  rzp.on('payment.failed', (response: any) => {
    console.error('Razorpay payment failed:', response.error);
    onError(new Error(response.error?.description || 'Payment was declined or failed.'));
  });

  rzp.open();
}
