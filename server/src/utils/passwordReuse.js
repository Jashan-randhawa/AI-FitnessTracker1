const bcrypt = require('bcryptjs');

/**
 * Checks if candidate password matches current password or any historical password (last 5)
 * @param {string} candidatePassword
 * @param {string} [currentHash]
 * @param {Array<{ hash: string }>} [passwordHistory]
 * @returns {Promise<{ isReused: boolean, type?: 'current' | 'history' }>}
 */
const checkPasswordReuse = async (candidatePassword, currentHash, passwordHistory = []) => {
  if (currentHash) {
    const isCurrent = await bcrypt.compare(candidatePassword, currentHash);
    if (isCurrent) {
      return { isReused: true, type: 'current' };
    }
  }

  if (Array.isArray(passwordHistory) && passwordHistory.length > 0) {
    for (const item of passwordHistory) {
      if (item?.hash) {
        const isHistorical = await bcrypt.compare(candidatePassword, item.hash);
        if (isHistorical) {
          return { isReused: true, type: 'history' };
        }
      }
    }
  }

  return { isReused: false };
};

module.exports = {
  checkPasswordReuse,
};
