import DocumentViewer from './DocumentViewer';

class SinglePageViewer extends DocumentViewer {
    //--------------------------------------------------------------------------
    // Protected
    //--------------------------------------------------------------------------

    /**
     * Load PDF from representation URL and set as document for pdf.js. Cache
     * the loading task so we can cancel if needed
     *
     * @protected
     * @param {Object} docInitParams - The params to pass to pdfjs
     * @return {Promise} Promise to initialize Viewer
     */
    initLoadingTask(docInitParams) {
        const { url } = docInitParams;

        const pageRange = this.getViewerOption('pageRange');

        if (typeof pageRange !== 'number') {
            return super.initLoadingTask(docInitParams);
        }

        this.pdfLoadingTask = PDFJS.getDocument(docInitParams);
        return this.pdfLoadingTask.then((doc) => {
            return doc
                .getPage(pageRange)
                .then(() => {
                    // Set the number of pages to 1 and replace the pages promise to the one you load
                    Object.defineProperty(doc, 'numPages', { value: 1 });
                    Object.defineProperty(doc.transport, 'pagePromises', {
                        value: doc.transport.pagePromises.slice(pageRange - 1)
                    });

                    this.pdfViewer.setDocument(doc);
                    this.initLinkService(doc, url);
                })
                .catch((err) => {
                    this.triggerError(err);
                });
        });
    }

    /**
     * Get pdf.js viewer.
     *
     * @protected
     * @override
     * @return {PDFJS.PDFViewer} PDF viewer type
     */
    getPdfViewer() {
        return new PDFJS.PDFSinglePageViewer({
            container: this.docEl,
            linkService: new PDFJS.PDFLinkService(),
            // Enhanced text selection uses more memory, so disable on mobile
            enhanceTextSelection: !this.isMobile
        });
    }
}

export default SinglePageViewer;
