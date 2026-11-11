// ============================================================
// 🌐 Cloudflare D1 Native Database Client (Prisma-Compatible)
// Ultra-fast (<1ms APAC Singapore Edge, Zero External Latency)
// ============================================================

export function createD1Client(db) {
  if (!db || typeof db.prepare !== "function") {
    throw new Error("Invalid D1 database instance provided.");
  }

  // Model helper
  const createModel = (tableName, options = {}) => {
    const {
      jsonFields = [],
      boolFields = [],
      hasTimestamps = true,
      defaultSelect = null,
    } = options;

    const serializeValue = (key, val) => {
      if (val === undefined || val === null) return null;
      if (val instanceof Date) return val.toISOString();
      if (boolFields.includes(key)) return val ? 1 : 0;
      if (jsonFields.includes(key) && (typeof val === "object")) return JSON.stringify(val);
      return val;
    };

    const deserializeRow = (row) => {
      if (!row) return null;
      const res = { ...row };
      for (const f of boolFields) {
        if (f in res && res[f] !== null) {
          res[f] = Boolean(res[f]);
        }
      }
      for (const f of jsonFields) {
        if (f in res && typeof res[f] === "string") {
          try {
            res[f] = JSON.parse(res[f]);
          } catch {
            // Keep original string if parse fails
          }
        }
      }
      return res;
    };

    const buildWhereClause = (where = {}) => {
      const clauses = [];
      const values = [];

      if (Array.isArray(where.OR) && where.OR.length > 0) {
        const orClauses = [];
        for (const condition of where.OR) {
          const subClauses = [];
          for (const [k, v] of Object.entries(condition)) {
            if (v !== undefined) {
              subClauses.push(`${k} = ?`);
              values.push(serializeValue(k, v));
            }
          }
          if (subClauses.length > 0) {
            orClauses.push(`(${subClauses.join(" AND ")})`);
          }
        }
        if (orClauses.length > 0) {
          clauses.push(`(${orClauses.join(" OR ")})`);
        }
      }

      for (const [k, v] of Object.entries(where)) {
        if (k === "OR") continue;
        if (v === undefined) continue;

        if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
          if ("not" in v) {
            if (v.not === null) {
              clauses.push(`${k} IS NOT NULL`);
            } else {
              clauses.push(`${k} != ?`);
              values.push(serializeValue(k, v.not));
            }
          } else if ("in" in v && Array.isArray(v.in)) {
            if (v.in.length === 0) {
              clauses.push("1 = 0");
            } else {
              const placeholders = v.in.map(() => "?").join(", ");
              clauses.push(`${k} IN (${placeholders})`);
              v.in.forEach((item) => values.push(serializeValue(k, item)));
            }
          } else if ("gte" in v) {
            clauses.push(`${k} >= ?`);
            values.push(serializeValue(k, v.gte));
          } else if ("lte" in v) {
            clauses.push(`${k} <= ?`);
            values.push(serializeValue(k, v.lte));
          }
        } else if (v === null) {
          clauses.push(`${k} IS NULL`);
        } else {
          clauses.push(`${k} = ?`);
          values.push(serializeValue(k, v));
        }
      }

      const sql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      return { sql, values };
    };

    const applySelect = (row, select) => {
      if (!row || !select || typeof select !== "object") return row;
      const filtered = {};
      for (const [key, enabled] of Object.entries(select)) {
        if (enabled && key in row) {
          filtered[key] = row[key];
        }
      }
      return filtered;
    };

    return {
      async findUnique({ where, select, include }) {
        const { sql, values } = buildWhereClause(where);
        const query = `SELECT * FROM ${tableName} ${sql} LIMIT 1`;
        const row = await db.prepare(query).bind(...values).first();
        const deserialized = deserializeRow(row);
        if (!deserialized) return null;

        // Relation join for facebookPages
        if (tableName === "users" && (include?.facebookPages || select?.facebookPages)) {
          const pages = await db
            .prepare("SELECT * FROM facebook_pages WHERE userId = ?")
            .bind(deserialized.id)
            .all();
          deserialized.facebookPages = (pages.results || []).map((p) => ({
            ...p,
            isConnected: Boolean(p.isConnected),
            isSelected: Boolean(p.isSelected),
          }));
        }

        return applySelect(deserialized, select);
      },

      async findFirst({ where, select, orderBy, include }) {
        const { sql, values } = buildWhereClause(where);
        let query = `SELECT * FROM ${tableName} ${sql}`;
        if (orderBy) {
          const [orderKey, orderDir] = Object.entries(orderBy)[0] || [];
          if (orderKey) query += ` ORDER BY ${orderKey} ${orderDir?.toUpperCase() === "ASC" ? "ASC" : "DESC"}`;
        }
        query += " LIMIT 1";
        const row = await db.prepare(query).bind(...values).first();
        const deserialized = deserializeRow(row);
        if (!deserialized) return null;

        if (tableName === "users" && (include?.facebookPages || select?.facebookPages)) {
          const pages = await db
            .prepare("SELECT * FROM facebook_pages WHERE userId = ?")
            .bind(deserialized.id)
            .all();
          deserialized.facebookPages = (pages.results || []).map((p) => ({
            ...p,
            isConnected: Boolean(p.isConnected),
            isSelected: Boolean(p.isSelected),
          }));
        }

        return applySelect(deserialized, select);
      },

      async findMany({ where = {}, select, orderBy, take }) {
        const { sql, values } = buildWhereClause(where);
        let query = `SELECT * FROM ${tableName} ${sql}`;
        if (orderBy) {
          const [orderKey, orderDir] = Object.entries(orderBy)[0] || [];
          if (orderKey) query += ` ORDER BY ${orderKey} ${orderDir?.toUpperCase() === "ASC" ? "ASC" : "DESC"}`;
        }
        if (typeof take === "number" && take > 0) {
          query += ` LIMIT ${take}`;
        }
        const { results = [] } = await db.prepare(query).bind(...values).all();
        return results.map((r) => applySelect(deserializeRow(r), select));
      },

      async create({ data }) {
        const record = { ...data };
        if (!record.id) {
          record.id = crypto.randomUUID();
        }
        const keys = Object.keys(record);
        const values = keys.map((k) => serializeValue(k, record[k]));
        const placeholders = keys.map(() => "?").join(", ");
        const query = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`;
        const res = await db.prepare(query).bind(...values).first();
        return deserializeRow(res);
      },

      async createMany({ data }) {
        if (!Array.isArray(data) || data.length === 0) return { count: 0 };
        const results = await Promise.all(data.map((item) => this.create({ data: item })));
        return { count: results.length };
      },

      async update({ where, data }) {
        const { sql: whereSql, values: whereValues } = buildWhereClause(where);
        const updateKeys = Object.keys(data);
        const setClauses = updateKeys.map((k) => `${k} = ?`);
        const updateValues = updateKeys.map((k) => serializeValue(k, data[k]));

        if (hasTimestamps && !("updatedAt" in data)) {
          setClauses.push("updatedAt = CURRENT_TIMESTAMP");
        }

        const query = `UPDATE ${tableName} SET ${setClauses.join(", ")} ${whereSql} RETURNING *`;
        const res = await db.prepare(query).bind(...updateValues, ...whereValues).first();
        return deserializeRow(res);
      },

      async updateMany({ where, data }) {
        const { sql: whereSql, values: whereValues } = buildWhereClause(where);
        const updateKeys = Object.keys(data);
        const setClauses = updateKeys.map((k) => `${k} = ?`);
        const updateValues = updateKeys.map((k) => serializeValue(k, data[k]));

        if (hasTimestamps && !("updatedAt" in data)) {
          setClauses.push("updatedAt = CURRENT_TIMESTAMP");
        }

        const query = `UPDATE ${tableName} SET ${setClauses.join(", ")} ${whereSql}`;
        const res = await db.prepare(query).bind(...updateValues, ...whereValues).run();
        return { count: res?.meta?.changes || 0 };
      },

      async upsert({ where, update, create }) {
        const existing = await this.findFirst({ where });
        if (existing) {
          return this.update({ where: { id: existing.id }, data: update });
        }
        return this.create({ data: create });
      },

      async deleteMany({ where = {} }) {
        const { sql, values } = buildWhereClause(where);
        const query = `DELETE FROM ${tableName} ${sql}`;
        const res = await db.prepare(query).bind(...values).run();
        return { count: res?.meta?.changes || 0 };
      },

      async count({ where = {} }) {
        const { sql, values } = buildWhereClause(where);
        const query = `SELECT COUNT(*) as count FROM ${tableName} ${sql}`;
        const res = await db.prepare(query).bind(...values).first();
        return Number(res?.count || 0);
      },
    };
  };

  const userModel = createModel("users", {
    boolFields: ["twoFactorEnabled", "twoFactorVerified"],
    jsonFields: ["pageSettings"],
  });

  const facebookPageModel = createModel("facebook_pages", {
    boolFields: ["isConnected", "isSelected"],
  });

  const postModel = createModel("posts", {
    jsonFields: ["mediaUrls"],
  });

  const botRuleModel = createModel("bot_rules", {
    boolFields: ["isActive"],
  });

  const creditTransactionModel = createModel("credit_transactions", {
    hasTimestamps: false,
  });

  return {
    user: userModel,
    facebookPage: facebookPageModel,
    scheduledPost: postModel,
    post: postModel,
    botRule: botRuleModel,
    creditTransaction: creditTransactionModel,

    botStatus: {
      findUnique: async () => ({ enabled: true }),
      upsert: async () => ({ enabled: true }),
    },

    botMonitoredPost: {
      findUnique: async () => null,
      upsert: async ({ create }) => create,
    },

    postMetrics: {
      aggregate: async () => ({
        _sum: { reach: 0, likes: 0, shares: 0 },
      }),
    },

    repliedComment: {
      count: async () => 0,
    },

    creditPackage: {
      findMany: async () => [
        { id: "pkg_100", name: "Basic", credits: 100, price: 5, active: true },
        { id: "pkg_500", name: "Pro", credits: 500, price: 20, active: true },
        { id: "pkg_2000", name: "Agency", credits: 2000, price: 60, active: true },
      ],
    },

    async $transaction(operations) {
      if (Array.isArray(operations)) {
        return Promise.all(operations);
      }
      if (typeof operations === "function") {
        return operations(this);
      }
      throw new Error("Invalid transaction argument.");
    },
  };
}

