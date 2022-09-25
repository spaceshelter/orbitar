export type AuthResetPasswordRequest = {
    email: string;
};

export type AuthResetPasswordResponse = {
    result: boolean;
};

export type AuthNewPasswordRequest = {
    password: string;
    code: string;
};

export type AuthNewPasswordResponse = {
    result: boolean;
};

export type AuthCheckResetPasswordCodeRequest = {
    code: string;
};

export type AuthCheckResetPasswordCodeResponse = {
    result: boolean;
};
