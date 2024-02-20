import ComgateBase from "../core/comgate-base";
import { PaymentProviderKeys } from "../types";

class ComgateProviderService extends ComgateBase {
  static identifier = PaymentProviderKeys.COMGATE;

  constructor(_, options) {
    super(_, options);
  }
}

export default ComgateProviderService;
