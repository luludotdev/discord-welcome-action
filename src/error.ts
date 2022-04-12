import { type AnnotationProperties } from '@actions/core'

export class AnnotatedError extends Error {
  public readonly annotation: string
  public readonly properties: Readonly<AnnotationProperties>

  constructor(
    failure: string,
    annotation: string,
    properties: AnnotationProperties
  ) {
    super(failure)

    this.annotation = annotation
    this.properties = Object.freeze(properties)
  }
}
