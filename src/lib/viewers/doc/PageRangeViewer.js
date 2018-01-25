import DocBaseViewer from './DocBaseViewer';
import DocPreloader from './DocPreloader';
import fullscreen from '../../Fullscreen';
import { ICON_FULLSCREEN_IN, ICON_FULLSCREEN_OUT, ICON_ZOOM_IN, ICON_ZOOM_OUT } from '../../icons/icons';
import './Document.scss';
import Browser from '../../Browser';

const RANGE_REQUEST_CHUNK_SIZE_US = 1048576; // 1MB
const RANGE_REQUEST_CHUNK_SIZE_NON_US = 524288; // 512KB

class PageRangeViewer extends DocBaseViewer {
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @inheritdoc
     */
    setup() {
        console.log('1 --> setup RangePageViewer'); // DEBUG
        // Call super() to set up common layout
        super.setup();
        this.docEl.classList.add('bp-doc-document');

        // Set up preloader
        this.preloader = new DocPreloader(this.previewUI);
        this.preloader.addListener('preload', () => {
            this.options.logger.setPreloaded();
            this.resetLoadTimeout(); // Some content is visible - reset load timeout
        });
    }

    /**
     * @inheritdoc
     */
    destroy() {
        super.destroy();
        this.preloader.removeAllListeners('preload');
    }

    /**
     * Handles keyboard events for document viewer.
     *
     * @override
     * @param {string} key - Keydown key
     * @return {boolean} Consumed or not
     */
    onKeydown(key) {
        if (key === 'Shift++') {
            this.zoomIn();
            return true;
        } else if (key === 'Shift+_') {
            this.zoomOut();
            return true;
        } else if (key === 'ArrowUp' && fullscreen.isFullscreen(this.containerEl)) {
            this.previousPage();
            return true;
        } else if (key === 'ArrowDown' && fullscreen.isFullscreen(this.containerEl)) {
            this.nextPage();
            return true;
        }

        return super.onKeydown(key);
    }

    //--------------------------------------------------------------------------
    // Protected
    //--------------------------------------------------------------------------

    /**
     * Loads PDF.js with provided PDF.
     *
     * @protected
     * @param {string} pdfUrl - The URL of the PDF to load
     * @return {Promise} Promise to initialize Viewer
     */
    initViewer(pdfUrl) {
        this.bindDOMListeners();

        // Initialize pdf.js in container
        this.pdfViewer = new PDFJS.PDFSinglePageViewer({
            container: this.docEl,
            linkService: new PDFJS.PDFLinkService(),
            // Enhanced text selection uses more memory, so disable on mobile
            enhanceTextSelection: !this.isMobile
        });

        // Use chunk size set in viewer options if available
        let rangeChunkSize = this.getViewerOption('rangeChunkSize');

        // Otherwise, use large chunk size if locale is en-US and the default,
        // smaller chunk size if not. This is using a rough assumption that
        // en-US users have higher bandwidth to Box.
        if (!rangeChunkSize) {
            rangeChunkSize =
                this.options.location.locale === 'en-US'
                    ? RANGE_REQUEST_CHUNK_SIZE_US
                    : RANGE_REQUEST_CHUNK_SIZE_NON_US;
        }

        const docInitParams = {
            url: pdfUrl,
            rangeChunkSize
        };

        // Fix incorrectly cached range requests on older versions of iOS webkit browsers,
        // see: https://bugs.webkit.org/show_bug.cgi?id=82672
        if (Browser.isIOS()) {
            docInitParams.httpHeaders = {
                'If-None-Match': 'webkit-no-cache'
            };
        }

        // Load PDF from representation URL and set as document for pdf.js. Cache
        // the loading task so we can cancel if needed
        this.pdfLoadingTask = PDFJS.getDocument(docInitParams);
        return this.pdfLoadingTask
            .then((doc) => {
                console.log('1 --> debug', doc); // DEBUG
                const pageNumber = 14;

                return doc.getPage(pageNumber).then((pdfPage) => {
                    // this.setPage(10);
                    Object.defineProperty(doc, 'numPages', { value: Math.min(doc.numPages, 1) });
                    // Object.defineProperty(doc.transport, 'pageCache', { value: doc.transport.pageCache.slice(9) });
                    Object.defineProperty(doc.transport, 'pagePromises', {
                        value: doc.transport.pagePromises.slice(pageNumber - 1)
                    });

                    this.pdfViewer.setDocument(doc);
                    // this.pdfViewer.currentPageNumber = 9;

                    const { linkService } = this.pdfViewer;
                    if (linkService instanceof PDFJS.PDFLinkService) {
                        linkService.setDocument(doc, pdfUrl);
                        linkService.setViewer(this.pdfViewer);
                    }
                });
            })
            .catch((err) => {
                /* eslint-disable no-console */
                console.error(err);
                /* eslint-enable no-console */

                // Display a generic error message but log the real one
                const error = err;
                if (error instanceof Error) {
                    error.displayMessage = __('error_document');
                }

                this.triggerError(error);
            });
    }

    //--------------------------------------------------------------------------
    // Event Listeners
    //--------------------------------------------------------------------------

    /**
     * Bind event listeners for document controls
     *
     * @private
     * @return {void}
     */
    bindControlListeners() {
        super.bindControlListeners();

        this.controls.add(__('zoom_out'), this.zoomOut, 'bp-doc-zoom-out-icon', ICON_ZOOM_OUT);
        this.controls.add(__('zoom_in'), this.zoomIn, 'bp-doc-zoom-in-icon', ICON_ZOOM_IN);

        this.pageControls.add(this.pdfViewer.currentPageNumber, this.pdfViewer.pagesCount);

        this.controls.add(
            __('enter_fullscreen'),
            this.toggleFullscreen,
            'bp-enter-fullscreen-icon',
            ICON_FULLSCREEN_IN
        );
        this.controls.add(__('exit_fullscreen'), this.toggleFullscreen, 'bp-exit-fullscreen-icon', ICON_FULLSCREEN_OUT);
    }
}

export default PageRangeViewer;
