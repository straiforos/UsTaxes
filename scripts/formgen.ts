import { PDFDocument, PDFField, PDFCheckBox } from 'pdf-lib'
import { readFile } from 'fs/promises'
import * as path from 'path'
import _ from 'lodash'

export const loadFile = async (path: string): Promise<PDFDocument> => {
  const file = await readFile(path)
  const bytearray = file.slice(0, file.byteLength)
  return await PDFDocument.load(bytearray)
}

export const normalizeName = (name: string): string => {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export const fieldFunction = (
  field: PDFField,
  index: number
): [string, string] => {
  const name = normalizeName(field.getName())
  const isNumeric = name.match(/^[0-9]+[a-z]*$/)
  const functionName = isNumeric ? `l${name}` : `f${index}`

  const returnType = (() => {
    if (isNumeric) return 'number'
    if (field instanceof PDFCheckBox) return 'boolean'
    return 'string'
  })()

  const fullReturnType = `${returnType}${
    field.isRequired() ? '' : ' | undefined'
  }`

  const defaultValue: string = (() => {
    if (field.isRequired()) {
      if (field instanceof PDFCheckBox) {
        return 'false'
      }
      return "''"
    }
    return 'undefined'
  })()

  // If the pdfField has a plain numeric name, we'll assume that
  // it corresponds to a numbered line on the return, and it will be given
  // a simple implementation like const l5 = (): number | undefined => ...
  // If a pdffield has a string name, then we'll provide a named implementation like
  // const spouseSocialNumber = () => ...
  // and an alias with the pdf index field number.
  const namedImplementation = `  /**
   * Index ${index}: ${field.getName()}
   */
  const ${isNumeric ? functionName : name} = (): ${fullReturnType} => {
    return ${defaultValue}
  }
`

  const alias = isNumeric
    ? undefined
    : `  const ${functionName} = (): ${fullReturnType} => this.${name}()
`

  const code: string = [namedImplementation, alias]
    .filter((x) => x !== undefined)
    .join('\n')

  return [code, functionName]
}

export const buildSource = (doc: PDFDocument, formName: string): string => {
  const functions = doc.getForm().getFields().map(fieldFunction)
  const [impls, functionNames] = _.unzip(functions)
  const className = normalizeName(formName)

  return `import Form from '@core/irsForms/Form'
import F1040 from '@core/irsForms/F1040'
import { Field } from '@core/pdfFiller'
import { displayNumber, sumFields } from '@core/irsForms/util'
import { AccountType, FilingStatus, State } from '@core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

export class ${className} extends Form {
  info: ValidatedInformation
  f1040: F1040
  formName: string
  state: State

  constructor(f1040: F1040) {
    super()
    this.info = f1040.info
    this.f1040 = f1040
    this.formName = '${formName}'
    this.state = 'AK' // <-- Fill here
  }

${impls.join('\n')}

  fields = (): Field[] => ([
    ${functionNames.map((name) => `[${name}, this.${name}]`).join(',\n    ')}
  ])
}

const make${className} = (f1040: F1040): ${className} =>
  new ${className}(f1040)

export default make${className}
`
}

export const generate = async (
  inFile: string,
  outFile: string | undefined = undefined
): Promise<void> => {
  const pdf = await loadFile(inFile)
  const name = path.parse(inFile).name
  const code = buildSource(pdf, name)
  if (outFile === undefined) {
    console.log(code)
  }
}

const help = () => {
  console.log(`
    Usage:
    npm run formgen <form-file>.pdf
  `)
}

const main = async () => {
  const args = process.argv.slice(2)
  process.argv.forEach((a) => console.log(a))

  if (args.length < 1) {
    help()
    process.exit()
  }

  await generate(args[0])
}

if (require.main === module) {
  void main()
}
