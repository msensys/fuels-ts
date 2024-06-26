/* eslint-disable @typescript-eslint/no-explicit-any */
import { ErrorCode, FuelError } from '@fuel-ts/errors';
import type { BytesLike } from '@fuel-ts/interfaces';
import { arrayify } from '@fuel-ts/utils';

import { AbiCoder } from './AbiCoder';
import { FunctionFragment } from './FunctionFragment';
import type { InputValue } from './encoding/coders/AbstractCoder';
import type { JsonAbi, JsonAbiConfigurable } from './types/JsonAbi';
import { type EncodingVersion } from './utils/constants';
import { findTypeById, getEncodingVersion } from './utils/json-abi';

export class Interface<TAbi extends JsonAbi = JsonAbi> {
  readonly functions!: Record<string, FunctionFragment>;
  readonly configurables: Record<string, JsonAbiConfigurable>;
  readonly jsonAbi: TAbi;
  readonly encoding: EncodingVersion;

  constructor(jsonAbi: TAbi) {
    this.jsonAbi = jsonAbi;
    this.encoding = getEncodingVersion(jsonAbi.encoding);

    this.functions = Object.fromEntries(
      this.jsonAbi.functions.map((x) => [x.name, new FunctionFragment(this.jsonAbi, x.name)])
    );

    this.configurables = Object.fromEntries(this.jsonAbi.configurables.map((x) => [x.name, x]));
  }

  /**
   * Returns function fragment for a dynamic input.
   * @param nameOrSignatureOrSelector - name (e.g. 'transfer'), signature (e.g. 'transfer(address,uint256)') or selector (e.g. '0x00000000a9059cbb') of the function fragment
   */
  getFunction(nameOrSignatureOrSelector: string): FunctionFragment {
    const fn = Object.values<FunctionFragment>(this.functions).find(
      (f) =>
        f.name === nameOrSignatureOrSelector ||
        f.signature === nameOrSignatureOrSelector ||
        f.selector === nameOrSignatureOrSelector
    );

    if (fn !== undefined) {
      return fn;
    }

    throw new FuelError(
      ErrorCode.FUNCTION_NOT_FOUND,
      `function ${nameOrSignatureOrSelector} not found: ${JSON.stringify(fn)}.`
    );
  }

  // Decode the result of a function call
  decodeFunctionResult(functionFragment: FunctionFragment | string, data: BytesLike): any {
    const fragment =
      typeof functionFragment === 'string' ? this.getFunction(functionFragment) : functionFragment;

    return fragment.decodeOutput(data);
  }

  decodeLog(data: BytesLike, logId: string): any {
    const loggedType = this.jsonAbi.loggedTypes.find((type) => type.logId === logId);
    if (!loggedType) {
      throw new FuelError(
        ErrorCode.LOG_TYPE_NOT_FOUND,
        `Log type with logId '${logId}' doesn't exist in the ABI.`
      );
    }

    return AbiCoder.decode(this.jsonAbi, loggedType.loggedType, arrayify(data), 0, {
      encoding: this.encoding,
    });
  }

  encodeConfigurable(name: string, value: InputValue) {
    const configurable = this.jsonAbi.configurables.find((c) => c.name === name);
    if (!configurable) {
      throw new FuelError(
        ErrorCode.CONFIGURABLE_NOT_FOUND,
        `A configurable with the '${name}' was not found in the ABI.`
      );
    }

    return AbiCoder.encode(this.jsonAbi, configurable.configurableType, value, {
      encoding: this.encoding,
    });
  }

  getTypeById(typeId: number) {
    return findTypeById(this.jsonAbi, typeId);
  }
}
