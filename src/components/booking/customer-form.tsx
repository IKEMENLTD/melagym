'use client';

import { useState } from 'react';

interface CustomerFormProps {
  onSubmit: (data: CustomerFormData) => void;
  loading?: boolean;
}

export interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  age_group: string;
}

const AGE_GROUPS = ['10代', '20代', '30代', '40代', '50代', '60代以上'];

export function CustomerForm({ onSubmit, loading }: CustomerFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'お名前を入力してください';
    if (!phone.trim()) {
      newErrors.phone = '電話番号を入力してください';
    } else {
      // ハイフン・スペースを除去した数字のみで判定
      const digitsOnly = phone.replace(/[-\s]/g, '');
      // 日本の電話番号: 携帯(070/080/090 + 8桁=11桁)、固定(0X + 8桁=10桁)、IP(050 + 8桁=11桁)、フリーダイヤル(0120 + 6桁=10桁)
      const isValidJapanesePhone = /^0[0-9]{9,10}$/.test(digitsOnly);
      if (!isValidJapanesePhone) {
        newErrors.phone = '正しい電話番号を入力してください（例: 090-1234-5678）';
      }
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '正しいメールアドレスを入力してください';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim(), age_group: ageGroup });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-bold text-black">お客様情報</h2>

      {/* 名前 */}
      <div>
        <label htmlFor="customer-name" className="block text-sm font-medium text-[#4d4d4d] mb-1">
          お名前 <span className="text-[#ef4444]" aria-label="必須">*</span>
        </label>
        <input
          id="customer-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="山田 太郎"
          autoComplete="name"
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className={`w-full px-4 py-3 border text-base min-h-[48px]
            ${errors.name ? 'border-[#ef4444]' : 'border-[#d9d9d9]'}`}
        />
        {errors.name && <p id="name-error" className="text-[#ef4444] text-xs mt-1" role="alert">{errors.name}</p>}
      </div>

      {/* 電話番号 */}
      <div>
        <label htmlFor="customer-phone" className="block text-sm font-medium text-[#4d4d4d] mb-1">
          電話番号 <span className="text-[#ef4444]" aria-label="必須">*</span>
        </label>
        <input
          id="customer-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="090-1234-5678"
          autoComplete="tel"
          inputMode="tel"
          aria-required="true"
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'phone-error' : undefined}
          className={`w-full px-4 py-3 border text-base min-h-[48px]
            ${errors.phone ? 'border-[#ef4444]' : 'border-[#d9d9d9]'}`}
        />
        {errors.phone && <p id="phone-error" className="text-[#ef4444] text-xs mt-1" role="alert">{errors.phone}</p>}
      </div>

      {/* メールアドレス */}
      <div>
        <label htmlFor="customer-email" className="block text-sm font-medium text-[#4d4d4d] mb-1">
          メールアドレス
        </label>
        <input
          id="customer-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={`w-full px-4 py-3 border text-base min-h-[48px]
            ${errors.email ? 'border-[#ef4444]' : 'border-[#d9d9d9]'}`}
        />
        {errors.email && <p id="email-error" className="text-[#ef4444] text-xs mt-1" role="alert">{errors.email}</p>}
      </div>

      {/* 年代 */}
      <div>
        <label className="block text-sm font-medium text-[#4d4d4d] mb-1">年代</label>
        <div className="grid grid-cols-3 gap-2">
          {AGE_GROUPS.map((ag) => (
            <button
              key={ag}
              type="button"
              onClick={() => setAgeGroup(ag)}
              className={`py-2.5 border text-sm font-medium transition-colors min-h-[44px]
                ${ageGroup === ag
                  ? 'bg-[#ff5000] text-white border-[#ff5000]'
                  : 'bg-white text-[#4d4d4d] border-[#d9d9d9] active:bg-[#f0f0f0]'}`}
            >
              {ag}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-[#ff5000] text-black font-bold text-base rounded-full
          disabled:opacity-50 hover:bg-[#e64800] hover:scale-[1.02] active:bg-[#e64800] transition-all min-h-[56px] tracking-wider"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="mela-spinner-sm" />
            処理中...
          </span>
        ) : '予約を確定する'}
      </button>
    </form>
  );
}
