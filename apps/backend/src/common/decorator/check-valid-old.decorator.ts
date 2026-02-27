import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsAtLeast14(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAtLeast14',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          const birthDate = new Date(value);
          const today = new Date();

          const age = today.getFullYear() - birthDate.getFullYear();

          const m = today.getMonth() - birthDate.getMonth();

          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            return age - 1 >= 14;
          }

          return age >= 14;
        },
      },
    });
  };
}
