const mongoose = require('mongoose');
const SystemConfig = require('../../server/models/SystemConfig');

describe('SystemConfig Model', () => {
  beforeEach(async () => {
    // Clear the collection before each test
    await SystemConfig.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid system config', async () => {
      const configData = {
        key: 'test_config',
        value: 100,
        description: 'Test configuration',
        category: 'system',
        dataType: 'number',
        defaultValue: 50,
        validation: { min: 0, max: 200 }
      };

      const config = new SystemConfig(configData);
      const saved = await config.save();

      expect(saved._id).toBeDefined();
      expect(saved.key).toBe('test_config');
      expect(saved.value).toBe(100);
      expect(saved.description).toBe('Test configuration');
      expect(saved.category).toBe('system');
      expect(saved.dataType).toBe('number');
      expect(saved.defaultValue).toBe(50);
      expect(saved.isEditable).toBe(true);
      expect(saved.isPublic).toBe(false);
      expect(saved.createdAt).toBeDefined();
      expect(saved.updatedAt).toBeDefined();
    });

    it('should require mandatory fields', async () => {
      const config = new SystemConfig({});

      let error;
      try {
        await config.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.key).toBeDefined();
      expect(error.errors.category).toBeDefined();
      expect(error.errors.dataType).toBeDefined();
    });

    it('should enforce unique key constraint', async () => {
      await SystemConfig.ensureIndexes();

      const configData = {
        key: 'unique_key',
        category: 'system',
        dataType: 'string',
        value: 'test'
      };

      await new SystemConfig(configData).save();

      const duplicate = new SystemConfig({
        ...configData,
        value: 'different'
      });

      let error;
      try {
        await duplicate.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.code === 11000 || error.name === 'MongoServerError').toBe(true);
    });

    it('should validate category enum', async () => {
      const config = new SystemConfig({
        key: 'test',
        category: 'invalid_category',
        dataType: 'string'
      });

      let error;
      try {
        await config.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.category).toBeDefined();
    });

    it('should validate dataType enum', async () => {
      const config = new SystemConfig({
        key: 'test',
        category: 'system',
        dataType: 'invalid_type'
      });

      let error;
      try {
        await config.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.dataType).toBeDefined();
    });

    it('should accept all valid categories', async () => {
      const validCategories = ['operator', 'operations', 'processing', 'notification',
        'payment', 'system', 'affiliate', 'customer', 'quality', 'performance'];

      for (const category of validCategories) {
        const config = new SystemConfig({
          key: `test_${category}`,
          category: category,
          dataType: 'string',
          value: 'test'
        });

        const saved = await config.save();
        expect(saved.category).toBe(category);
      }
    });

    it('should accept all valid data types', async () => {
      const validDataTypes = ['string', 'number', 'boolean', 'array', 'object'];

      for (const dataType of validDataTypes) {
        let value;
        switch (dataType) {
        case 'string': value = 'test'; break;
        case 'number': value = 123; break;
        case 'boolean': value = true; break;
        case 'array': value = [1, 2, 3]; break;
        case 'object': value = { test: 'value' }; break;
        }

        const config = new SystemConfig({
          key: `test_${dataType}`,
          category: 'system',
          dataType: dataType,
          value: value
        });

        const saved = await config.save();
        expect(saved.dataType).toBe(dataType);
        expect(saved.value).toEqual(value);
      }
    });

    it('should trim string fields', async () => {
      const config = new SystemConfig({
        key: '  test_key  ',
        description: '  Test description  ',
        category: 'system',
        dataType: 'string',
        value: 'test'
      });

      const saved = await config.save();
      expect(saved.key).toBe('test_key');
      expect(saved.description).toBe('Test description');
    });
  });

  describe('Value Validation', () => {
    describe('Number validation', () => {
      it('should reject non-number values for number dataType', async () => {
        const config = new SystemConfig({
          key: 'number_config',
          category: 'system',
          dataType: 'number',
          value: 'not a number'
        });

        let error;
        try {
          await config.save();
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value must be a number');
      });

      it('should enforce minimum value validation', async () => {
        const config = new SystemConfig({
          key: 'number_config',
          category: 'system',
          dataType: 'number',
          value: 5,
          validation: { min: 10 }
        });

        let error;
        try {
          await config.save();
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value must be at least 10');
      });

      it('should enforce maximum value validation', async () => {
        const config = new SystemConfig({
          key: 'number_config',
          category: 'system',
          dataType: 'number',
          value: 100,
          validation: { max: 50 }
        });

        let error;
        try {
          await config.save();
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value must be at most 50');
      });

      it('should accept valid number within range', async () => {
        const config = new SystemConfig({
          key: 'number_config',
          category: 'system',
          dataType: 'number',
          value: 25,
          validation: { min: 10, max: 50 }
        });

        const saved = await config.save();
        expect(saved.value).toBe(25);
      });
    });

    describe('Boolean validation', () => {
      it('should reject non-boolean values for boolean dataType', async () => {
        const config = new SystemConfig({
          key: 'bool_config',
          category: 'system',
          dataType: 'boolean',
          value: 'true'
        });

        let error;
        try {
          await config.save();
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value must be a boolean');
      });

      it('should accept boolean values', async () => {
        const config = new SystemConfig({
          key: 'bool_config',
          category: 'system',
          dataType: 'boolean',
          value: true
        });

        const saved = await config.save();
        expect(saved.value).toBe(true);
      });
    });

    describe('String validation', () => {
      it('should reject non-string values for string dataType', async () => {
        const config = new SystemConfig({
          key: 'string_config',
          category: 'system',
          dataType: 'string',
          value: 123
        });

        let error;
        try {
          await config.save();
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value must be a string');
      });

      it('should enforce regex validation', async () => {
        const config = new SystemConfig({
          key: 'string_config',
          category: 'system',
          dataType: 'string',
          value: 'invalid-email',
          validation: { regex: '^[\\w\\.]+@[\\w\\.]+$' }
        });

        let error;
        try {
          await config.save();
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value does not match required format');
      });

      it('should accept valid string matching regex', async () => {
        const config = new SystemConfig({
          key: 'string_config',
          category: 'system',
          dataType: 'string',
          value: 'test@example.com',
          validation: { regex: '^[\\w\\.]+@[\\w\\.]+$' }
        });

        const saved = await config.save();
        expect(saved.value).toBe('test@example.com');
      });
    });

    describe('Array validation', () => {
      it('should reject non-array values for array dataType', async () => {
        const config = new SystemConfig({
          key: 'array_config',
          category: 'system',
          dataType: 'array',
          value: 'not an array'
        });

        let error;
        try {
          await config.save();
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value must be an array');
      });

      it('should accept array values', async () => {
        const config = new SystemConfig({
          key: 'array_config',
          category: 'system',
          dataType: 'array',
          value: ['item1', 'item2', 'item3']
        });

        const saved = await config.save();
        expect(saved.value).toEqual(['item1', 'item2', 'item3']);
      });
    });

    describe('Object validation', () => {
      it('should reject non-object values for object dataType', async () => {
        const config = new SystemConfig({
          key: 'object_config',
          category: 'system',
          dataType: 'object',
          value: 'not an object'
        });

        let error;
        try {
          await config.save();
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value must be an object');
      });

      it('should reject arrays for object dataType', async () => {
        const config = new SystemConfig({
          key: 'object_config',
          category: 'system',
          dataType: 'object',
          value: [1, 2, 3]
        });

        let error;
        try {
          await config.save();
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value must be an object');
      });

      it('should accept object values', async () => {
        const config = new SystemConfig({
          key: 'object_config',
          category: 'system',
          dataType: 'object',
          value: { setting1: 'value1', setting2: 123 }
        });

        const saved = await config.save();
        expect(saved.value).toEqual({ setting1: 'value1', setting2: 123 });
      });
    });

    describe('Allowed values validation', () => {
      it('should enforce allowed values', async () => {
        const config = new SystemConfig({
          key: 'enum_config',
          category: 'system',
          dataType: 'string',
          value: 'invalid',
          validation: { allowedValues: ['option1', 'option2', 'option3'] }
        });

        let error;
        try {
          await config.save();
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value must be one of: option1, option2, option3');
      });

      it('should accept allowed values', async () => {
        const config = new SystemConfig({
          key: 'enum_config',
          category: 'system',
          dataType: 'string',
          value: 'option2',
          validation: { allowedValues: ['option1', 'option2', 'option3'] }
        });

        const saved = await config.save();
        expect(saved.value).toBe('option2');
      });
    });
  });

  describe('Static Methods', () => {
    describe('getValue', () => {
      it('should return config value', async () => {
        await SystemConfig.create({
          key: 'test_key',
          category: 'system',
          dataType: 'string',
          value: 'actual_value',
          defaultValue: 'default_value'
        });

        const value = await SystemConfig.getValue('test_key');
        expect(value).toBe('actual_value');
      });

      it('should return defaultValue when value is undefined', async () => {
        await SystemConfig.create({
          key: 'test_key',
          category: 'system',
          dataType: 'string',
          defaultValue: 'default_value'
        });

        const value = await SystemConfig.getValue('test_key');
        expect(value).toBe('default_value');
      });

      it('should return provided default when config not found', async () => {
        const value = await SystemConfig.getValue('non_existent', 'fallback');
        expect(value).toBe('fallback');
      });

      it('should return null when config not found and no default provided', async () => {
        const value = await SystemConfig.getValue('non_existent');
        expect(value).toBeNull();
      });
    });

    describe('setValue', () => {
      it('should update config value', async () => {
        await SystemConfig.create({
          key: 'test_key',
          category: 'system',
          dataType: 'string',
          value: 'old_value',
          isEditable: true
        });

        const updated = await SystemConfig.setValue('test_key', 'new_value');
        expect(updated.value).toBe('new_value');
        expect(updated.updatedAt.getTime()).toBeGreaterThan(updated.createdAt.getTime());
      });

      it('should throw error for non-existent config', async () => {
        let error;
        try {
          await SystemConfig.setValue('non_existent', 'value');
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Configuration key not found');
      });

      it('should throw error for non-editable config', async () => {
        await SystemConfig.create({
          key: 'readonly_key',
          category: 'system',
          dataType: 'string',
          value: 'value',
          isEditable: false
        });

        let error;
        try {
          await SystemConfig.setValue('readonly_key', 'new_value');
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Configuration is not editable');
      });

      it('should update updatedBy when provided', async () => {
        const adminId = new mongoose.Types.ObjectId();

        await SystemConfig.create({
          key: 'test_key',
          category: 'system',
          dataType: 'string',
          value: 'old_value',
          isEditable: true
        });

        const updated = await SystemConfig.setValue('test_key', 'new_value', adminId);
        expect(updated.updatedBy.toString()).toBe(adminId.toString());
      });

      it('should validate new value according to dataType', async () => {
        await SystemConfig.create({
          key: 'number_key',
          category: 'system',
          dataType: 'number',
          value: 10,
          isEditable: true,
          validation: { min: 0, max: 100 }
        });

        let error;
        try {
          await SystemConfig.setValue('number_key', 150);
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('Value must be at most 100');
      });
    });

    describe('getByCategory', () => {
      beforeEach(async () => {
        await SystemConfig.create([
          { key: 'sys1', category: 'system', dataType: 'string', isPublic: true },
          { key: 'sys2', category: 'system', dataType: 'string', isPublic: false },
          { key: 'op1', category: 'operator', dataType: 'string', isPublic: true },
          { key: 'op2', category: 'operator', dataType: 'string', isPublic: false }
        ]);
      });

      it('should return all configs for a category', async () => {
        const configs = await SystemConfig.getByCategory('system');
        expect(configs).toHaveLength(2);
        expect(configs[0].key).toBe('sys1');
        expect(configs[1].key).toBe('sys2');
      });

      it('should return only public configs when specified', async () => {
        const configs = await SystemConfig.getByCategory('system', true);
        expect(configs).toHaveLength(1);
        expect(configs[0].key).toBe('sys1');
        expect(configs[0].isPublic).toBe(true);
      });

      it('should return empty array for non-existent category', async () => {
        const configs = await SystemConfig.getByCategory('non_existent');
        expect(configs).toHaveLength(0);
      });

      it('should sort by key', async () => {
        await SystemConfig.create([
          { key: 'z_config', category: 'system', dataType: 'string' },
          { key: 'a_config', category: 'system', dataType: 'string' },
          { key: 'm_config', category: 'system', dataType: 'string' }
        ]);

        const configs = await SystemConfig.getByCategory('system');
        const testConfigs = configs.filter(c => c.key.includes('_config'));
        expect(testConfigs[0].key).toBe('a_config');
        expect(testConfigs[1].key).toBe('m_config');
        expect(testConfigs[2].key).toBe('z_config');
      });
    });

    describe('getPublicConfigs', () => {
      it('should return only public configs', async () => {
        await SystemConfig.create([
          { key: 'pub1', category: 'system', dataType: 'string', isPublic: true },
          { key: 'priv1', category: 'system', dataType: 'string', isPublic: false },
          { key: 'pub2', category: 'operator', dataType: 'string', isPublic: true },
          { key: 'priv2', category: 'operator', dataType: 'string', isPublic: false }
        ]);

        const configs = await SystemConfig.getPublicConfigs();
        expect(configs).toHaveLength(2);
        expect(configs.every(c => c.isPublic === true)).toBe(true);
      });

      it('should sort by category then key', async () => {
        await SystemConfig.create([
          { key: 'b_config', category: 'system', dataType: 'string', isPublic: true },
          { key: 'a_config', category: 'system', dataType: 'string', isPublic: true },
          { key: 'c_config', category: 'operator', dataType: 'string', isPublic: true }
        ]);

        const configs = await SystemConfig.getPublicConfigs();
        expect(configs[0].category).toBe('operator');
        expect(configs[1].key).toBe('a_config');
        expect(configs[2].key).toBe('b_config');
      });
    });

    describe('initializeDefaults', () => {
      it('should create default configurations', async () => {
        await SystemConfig.initializeDefaults();

        const configs = await SystemConfig.find({});
        expect(configs.length).toBeGreaterThan(0);

        // Check specific defaults
        const maxOperators = await SystemConfig.findOne({ key: 'max_operators_per_shift' });
        expect(maxOperators).toBeDefined();
        expect(maxOperators.value).toBe(10);
        expect(maxOperators.category).toBe('operator');
        expect(maxOperators.dataType).toBe('number');

        const maintenanceMode = await SystemConfig.findOne({ key: 'maintenance_mode' });
        expect(maintenanceMode).toBeDefined();
        expect(maintenanceMode.value).toBe(false);
        expect(maintenanceMode.isPublic).toBe(true);
      });

      it('should not overwrite existing configurations', async () => {
        // Create config with different value
        await SystemConfig.create({
          key: 'max_operators_per_shift',
          value: 20,
          category: 'operator',
          dataType: 'number'
        });

        await SystemConfig.initializeDefaults();

        const config = await SystemConfig.findOne({ key: 'max_operators_per_shift' });
        expect(config.value).toBe(20); // Should keep existing value
      });

      it('should add missing configurations', async () => {
        // Create one config
        await SystemConfig.create({
          key: 'max_operators_per_shift',
          value: 20,
          category: 'operator',
          dataType: 'number'
        });

        await SystemConfig.initializeDefaults();

        // Should have added other defaults
        const maintenanceMode = await SystemConfig.findOne({ key: 'maintenance_mode' });
        expect(maintenanceMode).toBeDefined();
        expect(maintenanceMode.value).toBe(false);
      });
    });
  });

  describe('Timestamps', () => {
    it('should auto-generate timestamps on creation', async () => {
      const config = new SystemConfig({
        key: 'test',
        category: 'system',
        dataType: 'string',
        value: 'test'
      });

      const saved = await config.save();
      expect(saved.createdAt).toBeDefined();
      expect(saved.updatedAt).toBeDefined();
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on modification', async () => {
      const config = new SystemConfig({
        key: 'test',
        category: 'system',
        dataType: 'string',
        value: 'test'
      });

      const saved = await config.save();
      const originalUpdatedAt = saved.updatedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      saved.value = 'updated';
      await saved.save();

      expect(saved.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('toJSON transformation', () => {
    it('should include currentValue in JSON output', async () => {
      const config = new SystemConfig({
        key: 'test',
        category: 'system',
        dataType: 'string',
        value: 'actual',
        defaultValue: 'default'
      });

      const saved = await config.save();
      const json = saved.toJSON();

      expect(json.currentValue).toBe('actual');
      expect(json.__v).toBeUndefined();
    });

    it('should use defaultValue when value is undefined', async () => {
      const config = new SystemConfig({
        key: 'test',
        category: 'system',
        dataType: 'string',
        defaultValue: 'default'
      });

      const saved = await config.save();
      const json = saved.toJSON();

      expect(json.currentValue).toBe('default');
    });
  });

  describe('Edge Cases', () => {
    it('should handle mixed types for value and defaultValue', async () => {
      const config = new SystemConfig({
        key: 'mixed_config',
        category: 'system',
        dataType: 'object',
        value: { complex: { nested: ['array', 123, true] } },
        defaultValue: { simple: 'object' }
      });

      const saved = await config.save();
      expect(saved.value).toEqual({ complex: { nested: ['array', 123, true] } });
      expect(saved.defaultValue).toEqual({ simple: 'object' });
    });

    it('should handle empty validation object', async () => {
      const config = new SystemConfig({
        key: 'test',
        category: 'system',
        dataType: 'number',
        value: 100,
        validation: {}
      });

      const saved = await config.save();
      expect(saved.validation).toBeDefined();
      // Mongoose may add undefined properties to the validation subdocument
      // Check that no actual validation values are set
      expect(saved.validation.min).toBeUndefined();
      expect(saved.validation.max).toBeUndefined();
      expect(saved.validation.regex).toBeUndefined();
      // allowedValues may be initialized as empty array
      expect(saved.validation.allowedValues).toBeDefined();
      expect(saved.validation.allowedValues).toEqual([]);
    });

    it('should skip validation when value is not modified', async () => {
      const config = new SystemConfig({
        key: 'test',
        category: 'system',
        dataType: 'number',
        value: 100
      });

      const saved = await config.save();

      // Change non-value field
      saved.description = 'Updated description';
      const updated = await saved.save();

      expect(updated.description).toBe('Updated description');
    });
  });
});