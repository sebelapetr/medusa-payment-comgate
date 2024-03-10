import {PaymentProcessorError, PaymentProcessorSessionResponse, PaymentSessionStatus} from "@medusajs/medusa";
import {StatusResponseStatus} from "comgate-node/dist/types/endpoints/status";

export interface ComgatePaymentOptions {
  merchant: number;
  secret: string;
  test: boolean;
  debug: boolean;
}

export const PaymentProviderKeys = {
  COMGATE: "comgate",
};

export type ComgatePaymentProcessorSessionResponse = Omit<PaymentProcessorSessionResponse, 'session_data'> & {
  session_data: ComgateSessionData;
};

export type ComgateSessionData = {
  status: PaymentSessionStatus,
  comgateData: {
    transId: string | null,
    status: "INITIATED" | "CREATED" | "ERROR" | StatusResponseStatus,
    redirect: string | null,
    error: PaymentProcessorError | null,
  }
}

export type ComgateStatusRequest = {
  merchant: string; // identifikátor e-shopu v systému Comgate
  test: boolean; // Hodnota „true“ znamená, že platba byla založena jako testovací, hodnota „false“ znamená produkční verzi.
  price: number; // cena za produkt v centech nebo haléřích
  curr: string; // kód měny dle ISO 4217
  label: string; // krátký popis produktu (1-16 znaků)
  refId: string; // reference platby (variabilní symbol, číslo objednávky) v systému e-shopu
  email: string; // kontaktní email na Plátce
  transId: string; // unikátní alfanumerický identifikátor (kód) transakce (transactionId)
  secret: string; // heslo pro komunikaci na pozadí
  status: 'PAID' | 'CANCELLED' | 'AUTHORIZED'; // aktuální stav transakce
  payerId?: string; // identifikátor Plátce v systému e-shopu
  payerName?: string; // předání jména účtu patřící Plátci
  payerAcc?: string; // předání čísla účtu Plátce
  method?: string; // použitá metoda platby, z tabulky platebních metod
  account?: string; // identifikátor bankovního účtu e-shopu, na který Comgate Payments převede peníze
  phone?: string; // kontaktní telefon na Plátce
  name?: string; // identifikátor produktu – dle této položky je možné vyhledávat ve statistikách plateb Comgate platebního systému
  fee?: string; // Pokud má e-shop nastavené automatické strhávání poplatku za platbu, bude v tomto poli spočítaný poplatek za transakci, jinak bude pole nabývat hodnoty „unknown“
};
