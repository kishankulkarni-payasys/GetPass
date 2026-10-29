import apiClient from './client'

export const OCR_DOC_TYPES = {
  plate: 'plate',
  po: 'po',
  challan: 'challan',
}

// { ocr_enabled, po_lookup_enabled, ocr_confidence_threshold, max_challan_lines }
export async function getGateInConfig() {
  const response = await apiClient.get('/gate-in/config')
  return response.data
}

// Stateless OCR: the image is not stored here. Returns
// plate { plate, confidence } · po { po_number, supplier_name, confidence, field_confidence }
// · challan { challan_number, lines: [{ material, quantity, uom, confidence }], confidence }.
export async function readDocument(image, docType) {
  const formData = new FormData()
  formData.append('image', image)
  formData.append('doc_type', docType)
  const response = await apiClient.post('/gate-in/ocr', formData, {
    headers: { 'Content-Type': undefined },
  })
  return response.data
}

// { status: matched | not_found | not_checked, po: { po_number, supplier_name, lines } | null }
export async function lookupPo(poNumber) {
  const response = await apiClient.get(`/gate-in/po/${encodeURIComponent(poNumber)}`)
  return response.data
}

// [{ po_number, supplier_name, open_lines }]; `supplier` needs at least 3 characters.
export async function searchPoBySupplier(supplier) {
  const response = await apiClient.get('/gate-in/po-search', { params: { supplier } })
  return response.data
}
