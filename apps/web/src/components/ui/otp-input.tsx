import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface OtpInputProps {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
    autoFocus?: boolean;
}

export function OtpInput({ value, onChange, error, disabled, autoFocus }: OtpInputProps) {
    // Biến chuỗi string thành mảng 6 phần tử để render 6 ô
    const otpArray = value.split("").concat(Array(6).fill("")).slice(0, 6);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (autoFocus) {
            setTimeout(() => {
                otpRefs.current[0]?.focus();
            }, 50);
        }
    }, [autoFocus]);

    const handleOtpChange = (inputValue: string, index: number) => {
        const cleanValue = inputValue.replace(/[^0-9]/g, "");
        if (!cleanValue) {
            const newOtp = [...otpArray];
            newOtp[index] = "";
            onChange(newOtp.join(""));
            return;
        }

        const char = cleanValue[cleanValue.length - 1];
        const newOtp = [...otpArray];
        newOtp[index] = char;
        onChange(newOtp.join(""));

        if (index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace") {
            if (!otpArray[index] && index > 0) {
                const newOtp = [...otpArray];
                newOtp[index - 1] = "";
                onChange(newOtp.join(""));
                otpRefs.current[index - 1]?.focus();
            } else {
                const newOtp = [...otpArray];
                newOtp[index] = "";
                onChange(newOtp.join(""));
            }
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text");
        const digits = pastedData.replace(/[^0-9]/g, "").slice(0, 6);

        if (digits.length > 0) {
            const newOtp = [...otpArray];
            for (let i = 0; i < 6; i++) {
                newOtp[i] = digits[i] || "";
            }
            onChange(newOtp.join(""));

            const focusIndex = Math.min(digits.length, 5);
            otpRefs.current[focusIndex]?.focus();
        }
    };

    return (
        <div className="flex justify-between gap-2">
            {otpArray.map((digit, idx) => (
                <Input
                    key={idx}
                    ref={(el) => { otpRefs.current[idx] = el; }}
                    type="text"
                    maxLength={1}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                    onPaste={handleOtpPaste}
                    disabled={disabled}
                    className={cn(
                        "w-12 h-12 text-center text-xl font-bold rounded-md border border-input focus-visible:ring-2 focus-visible:ring-blue-600 transition-all",
                        error ? "border-red-500 focus-visible:ring-red-500" : "border-input"
                    )}
                    required
                />
            ))}
        </div>
    );
}