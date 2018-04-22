/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict'

const UrlUtil = require('../js/lib/urlutil')
const Filtering = require('./filtering')
const appActions = require('../js/actions/appActions')
const getSetting = require('../js/settings').getSetting
const settings = require('../js/constants/settings')

const getViewerUrl = UrlUtil.getPDFViewerUrl

/**
 * Check if the request is a PDF file.
 * @param {Object} details First argument of the webRequest.onHeadersReceived
 *                         event. The properties "responseHeaders" and "url"
 *                         are read.
 * @return {boolean} True if the resource is a PDF file.
 */
function isPDFFile (details) {
  console.log('isPDFFile-->details.url', details.url)
  var header = details.responseHeaders && details.responseHeaders['Content-Type']
  if (header) {
    console.log('isPDFFile--> got inside header')
    if (header.includes('application/pdf')) {
      console.log('1')
      return true
    }
    if (header.includes('application/octet-stream')) {
      if (details.url.toLowerCase().indexOf('.pdf') > 0) {
        console.log('2')
        return true
      }
      var cdHeader = details.responseHeaders['Content-Disposition']
      if (cdHeader && /\.pdf(["']|$)/i.test(cdHeader[0])) {
        console.log('3')
        return true
      }
    }
    if (UrlUtil.isFileScheme(details.url)) {
      // &&  UrlUtil.isFileType(details.url, 'pdf')){
      console.log('got here')
      return true
    }
  }
}

/**
 * @param {Object} details First argument of the webRequest.onHeadersReceived
 *                         event. The property "url" is read.
 * @return {boolean} True if the PDF file should be downloaded.
 */
function isPDFDownloadable (details) {
  if (details.url.indexOf('pdfjs.action=download') >= 0) {
    return true
  }
  // Display the PDF viewer regardless of the Content-Disposition header if the
  // file is displayed in the main frame, since most often users want to view
  // a PDF, and servers are often misconfigured.
  // If the query string contains "=download", do not unconditionally force the
  // viewer to open the PDF, but first check whether the Content-Disposition
  // header specifies an attachment. This allows sites like Google Drive to
  // operate correctly (#6106).
  if (details.resourceType === 'mainFrame' &&
      details.url.indexOf('=download') === -1) {
    return false
  }
  var cdHeader = (details.responseHeaders &&
    details.responseHeaders['Content-Disposition'])
  return (cdHeader && /^attachment/i.test(cdHeader[0]))
}

/**
 * Takes a set of headers, and set "Content-Disposition: attachment".
 * @param {Object} details First argument of the webRequest.onHeadersReceived
 *                         event. The property "responseHeaders" is read and
 *                         modified if needed.
 * @return {Object|undefined} The return value for the responseHeaders property
 */
function getHeadersWithContentDispositionAttachment (details) {
  var headers = details.responseHeaders
  var cdHeader = headers['Content-Disposition'] || []
  cdHeader.push('attachment')
  headers['Content-Disposition'] = cdHeader
  return headers
}

const onBeforeRequest = (details) => {
  const result = { resourceName: 'pdfjs' }
  if (details.resourceType === 'mainFrame' &&
    UrlUtil.isFileScheme(details.url) &&
    UrlUtil.isFileType(details.url, 'pdf')) {
     // console.log('file called', details.url)
      // console.log('file called', getViewerUrl(details.url))

      // appActions.loadURLRequested(details.tabId, getViewerUrl(details.url))
    result.cancel = true

    console.trace(result.cancel)
  }
  if (details.url === 'file:///home/omak/Documents/test.pdf' || details.url === 'http://www.orimi.com/pdf-test.pdf'
) {
    // console.log("onBeforeRequest-->result: ", result, "  for url:", details.url)
    // console.log('onBeforeRequest-->details:\n', details)
    // console.trace(result)
  }
  return result
}

const onHeadersReceived = (details) => {
  const result = { resourceName: 'pdfjs' }
  // Don't intercept POST requests until http://crbug.com/104058 is fixed.
  // console.log('onheadersReceieved', '   isPDFFile', isPDFFile(details), '\ndetails:', details)
  // console.trace('onHeadersReceived-->/n',details)
  if (details.resourceType === 'mainFrame' && details.method === 'GET' && isPDFFile(details)) {
    if (isPDFDownloadable(details)) {
      // Force download by ensuring that Content-Disposition: attachment is set
      result.responseHeaders = getHeadersWithContentDispositionAttachment(details)
      return result
    }

    // Replace frame with viewer
    appActions.loadURLRequested(details.tabId, getViewerUrl(details.url))
    result.cancel = true
  }
  return result
}

/**
 * Load PDF.JS
 */
module.exports.init = () => {
  if (getSetting(settings.PDFJS_ENABLED)) {
    Filtering.registerBeforeRequestFilteringCB(onBeforeRequest)
    Filtering.registerHeadersReceivedFilteringCB(onHeadersReceived)
  }
}
