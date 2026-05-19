import { ForgotPasswordForm } from "@/components/ui/forgot-password-form";
import zola from "@/assets/ZolaZola.svg";

const ForgotPasswordPage = () => {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen w-full bg-blue-50 py-10">
      <img src={zola} className="w-60 mb-5" alt="Zola logo" />
      <ForgotPasswordForm />
    </div>
  );
};

export default ForgotPasswordPage;
