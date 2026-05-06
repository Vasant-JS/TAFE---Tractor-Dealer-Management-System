export async function fileToUploadPayload(file: File) {
  const buffer = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    contentBase64: btoa(binary),
  }
}
