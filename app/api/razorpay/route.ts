import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { amount_in_paise } = await request.json();

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    // Use mock if keys are not set allowing local dev to test UI unhindered
    if (!key_id || !key_secret) {
      return NextResponse.json({
        id: "order_mock_" + Date.now(),
        amount: amount_in_paise,
        currency: "INR",
      });
    }

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${key_id}:${key_secret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: amount_in_paise,
        currency: 'INR',
        receipt: 'receipt_' + Date.now(),
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to create Razorpay order" },
      { status: 500 }
    );
  }
}
