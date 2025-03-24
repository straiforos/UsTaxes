import { PDFDocument, PDFField, PDFCheckBox, PDFTextField } from 'pdf-lib'
import * as path from 'path'
import fs from 'fs/promises'
import { jest } from '@jest/globals'

// Mock pdf-lib and fs
jest.mock('pdf-lib')
jest.mock('fs/promises')

/* eslint-disable @typescript-eslint/no-empty-function */
beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

// Import the module under test
import {
  loadFile,
  normalizeName,
  fieldFunction,
  buildSource,
  generate
} from '../../../scripts/formgen'

describe('formgen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('loadFile', () => {
    it('should load and parse a PDF file', async () => {
      const mockPdfBytes = Buffer.from('mock pdf content')
      const mockPdfDoc = {
        getForm: jest.fn(),
        context: {},
        catalog: {},
        isEncrypted: false,
        defaultWordBreaks: []
      } as unknown as PDFDocument

      const readFileSpy = jest
        .spyOn(fs, 'readFile')
        .mockResolvedValue(mockPdfBytes)
      const loadSpy = jest
        .spyOn(PDFDocument, 'load')
        .mockResolvedValue(mockPdfDoc)

      const result = await loadFile('test.pdf')

      expect(readFileSpy).toHaveBeenCalledWith('test.pdf')
      expect(loadSpy).toHaveBeenCalledWith(mockPdfBytes)
      expect(result).toBe(mockPdfDoc)
    })
  })

  describe('normalizeName', () => {
    it('should remove special characters from name', () => {
      const testCases = [
        ['Hello-World!', 'HelloWorld'],
        ['Form_1040(2023)', 'Form10402023'],
        ['123.45', '12345'],
        // Rename class "f1040" to match the regular expression ^[A-Z][a-zA-Z0-9]*$.sonarqube(typescript:S101)
        ['f1040', 'F1040']
      ] as const

      testCases.forEach(([input, expected]) => {
        expect(normalizeName(input)).toBe(expected)
      })
    })

    it('should handle empty string', () => {
      expect(normalizeName('')).toBe('')
    })
  })

  describe('fieldFunction', () => {
    it('should generate function for numeric field name', () => {
      const mockField: PDFField = {
        getName: () => '123',
        isRequired: () => true,
        acroField: {
          getType: () => 'Tx'
        }
      } as unknown as PDFField

      const [code, functionName] = fieldFunction(mockField, 0)

      expect(functionName).toBe('l123')
      expect(code).toContain('const l123 = (): number =>')
      expect(code).toContain("return ''")
    })

    it('should generate function for checkbox field', () => {
      const mockField = Object.create(PDFCheckBox.prototype, {
        getName: { value: () => 'isMarried' },
        isRequired: { value: () => true },
        acroField: { value: { getType: () => 'Btn' } }
      }) as PDFCheckBox

      const [code, functionName] = fieldFunction(mockField, 1)

      expect(functionName).toBe('f1')
      expect(code).toContain('const isMarried = (): boolean =>')
      expect(code).toContain('return false')
    })

    it('should handle optional fields', () => {
      const mockField: PDFTextField = {
        getName: () => 'optionalField',
        isRequired: () => false,
        acroField: {
          getType: () => 'Tx'
        }
      } as unknown as PDFTextField

      const [code, functionName] = fieldFunction(mockField, 2)

      expect(functionName).toBe('f2')
      expect(code).toContain('const optionalField = (): string | undefined =>')
      expect(code).toContain('return undefined')
    })
  })

  describe('buildSource', () => {
    it('should generate complete source code', () => {
      const mockForm = {
        getFields: () => [
          {
            getName: () => '1',
            isRequired: () => true,
            acroField: {
              getType: () => 'Tx'
            }
          } as unknown as PDFField,
          Object.create(PDFCheckBox.prototype, {
            getName: { value: () => 'checkbox1' },
            isRequired: { value: () => true },
            acroField: { value: { getType: () => 'Btn' } }
          }) as PDFCheckBox
        ]
      }

      const mockDoc = {
        getForm: () => mockForm,
        context: {},
        catalog: {},
        isEncrypted: false,
        defaultWordBreaks: []
      } as unknown as PDFDocument

      const source = buildSource(mockDoc, 'TestForm')

      expect(source).toContain('export class TestForm extends Form')
      expect(source).toContain('const l1 = (): number =>')
      expect(source).toContain('const checkbox1 = (): boolean =>')
    })
  })

  describe('generate', () => {
    it('should generate code for a PDF file', async () => {
      const mockField = {
        getName: () => '1',
        isRequired: () => true,
        acroField: {
          getType: () => 'Tx'
        }
      } as unknown as PDFField
      const mockPdfDoc = {
        getForm: () => ({
          getFields: () => [mockField]
        }),
        context: {},
        catalog: {},
        isEncrypted: false,
        defaultWordBreaks: []
      } as unknown as PDFDocument

      const mockFileContent = Buffer.from('mock pdf content')
      Object.defineProperty(mockFileContent, 'slice', {
        value: jest.fn().mockReturnValue(mockFileContent)
      })

      const loadSpy = jest
        .spyOn(PDFDocument, 'load')
        .mockResolvedValue(mockPdfDoc)
      jest.spyOn(fs, 'readFile').mockResolvedValue(mockFileContent)
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      await generate('test.pdf')

      expect(consoleSpy).toHaveBeenCalled()
      expect(loadSpy).toHaveBeenCalled()
    })
  })
})
