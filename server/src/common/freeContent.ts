/** Omit retired access/pricing fields when serializing documents saved by older releases. */
export const removeRetiredAccessFields = (record: Record<string, unknown>): void => {
  for (const field of ['isVip', 'vipExpireAt', 'vipPrice', 'priceInCoins', 'mainCoins', 'bonusCoins']) {
    delete record[field]
  }
}
