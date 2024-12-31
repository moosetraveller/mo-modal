// CSS module import does not work unless CSS file is explicit served as text/css
// import sheet from './modal.css' assert { type: 'css' }; 

import { EventHandler as EH, loadStyleSheet } from "./utils.js";

export const TAG_NAME = 'mo-modal';

/**
 * A simple Modal that could be used to confirm something. This implementation wraps a
 * <dialog> element. 
 */
export class Modal extends HTMLElement {

    static _modalStyleSheet = null;

    /* for communication between modals */
    static _eventBus = new EventTarget();

    get isOpen() {
        return this.hasAttribute('open');
    }

    get hasBackdrop() {
        return this.getAttribute('backdrop') !== 'false';
    }

    get hasStaticBackdrop() {
        return this.getAttribute('backdrop') === 'static';
    }

    get isAcceptingEscapeKey() {
        return this.getAttribute('keyboard') !== 'false';
    }

    get triggerElement() {
        return this._triggerElement;
    }

    constructor() {
        
        super();

        this.attachShadow({mode: 'open'});

        this.shadowRoot.innerHTML = `

            <style>
                :host(:not(:defined)) dialog {
                    display: none;
                }
            </style>
            
            <dialog>

                <header>
                    <slot name="title">Please Confirm</slot>
                </header>

                <section id="content">
                    <slot></slot>
                </section>

                <section id="buttonPanel">
                    <button id="cancelButton">Cancel</button>
                    <button id="confirmButton">Confirm</button>
                </section>

            </dialog>

        `;

        this._insertStyleSheet('./modal.css');

        this._uuid = crypto.randomUUID();

    }

    /**
     * Inserts style sheet from external file and makes sure that
     * it's only loaded/retrieved once even if the component is
     * used more than once.
     * 
     * @param {string} url url pointing to stylesheet
     */
    async _insertStyleSheet(url) {

        if (Modal._modalStyleSheet === null) {
            Modal._modalStyleSheet = loadStyleSheet(url);
        }

        Modal._modalStyleSheet
            .then(sheet => {

                this.shadowRoot.adoptedStyleSheets = [
                    ...(this.shadowRoot.adoptedStyleSheets || []),
                    sheet,
                ];

            });

        // add global stylesheet; only once
        if (document.querySelector(`style[data-component="${TAG_NAME}"]`) === null) {
            
            const style = document.createElement('style');
            style.setAttribute('data-component', TAG_NAME);
            
            document.head.appendChild(style);

            // this rule will not be visible within the style tag when looked up 
            // using the web developer console
            style.sheet.insertRule(`body:has(${TAG_NAME}[open]) { overflow: hidden; }`, 0);
            
        }

    }

    /**
     * This life cycle hook is called when the element is attached to the DOM and ready 
     * to be manipulated.
     */
    connectedCallback() {

        // using helper function EH.attach to add event listeners, in order to remove
        // them easily when disconnectedCallback is called

        EH.attach(`open.${this._uuid}`, Modal._eventBus, this._enforceExclusiveness.bind(this));
        
        this._cancelButton = this.shadowRoot.querySelector('#cancelButton');
        EH.attach('click.cancel', this._cancelButton, event => {
            this.close();
            this._emitCancelEvent(event);
        });

        this._confirmButton = this.shadowRoot.querySelector('#confirmButton');
        EH.attach('click.confirm', this._confirmButton, event => {
            this.close();
            this._emitConfirmEvent(event);
        });

        this._dialog = this.shadowRoot.querySelector('dialog');
        EH.attach('cancel', this._dialog, event => {
            if (this.isAcceptingEscapeKey) {
                this.close();
            }
            event.preventDefault();
        });

        // we are not using click because moving the mouse; see here:
        // https://stackoverflow.com/a/72916231/42659
        EH.attach('mousedown', this._dialog, event => {
            if (!this.hasStaticBackdrop && event.target.contains(this._dialog)) {
                this.close();
            }
        });

        this._ensureSyncWithDialogElement();

        this._render();

    }

    /**
     * Adds logic to make sure the <dialog> element is in sync with the
     * custom element itself.
     */
    _ensureSyncWithDialogElement() {

        EH.attach('close', this._dialog, () => {
            if (this.isOpen) {
                this.close();
            }
        });

        const showFn = this._dialog.show;
        this._dialog.show = () => {
            if (this._dialog.open === this.isOpen) {
                this.open();
                return;
            }
            showFn.call(this._dialog);
        }

        const showModalFn = this._dialog.showModal;
        this._dialog.showModal = () => {
            if (this._dialog.open === this.isOpen) {
                this.open();
                return;
            }
            showModalFn.call(this._dialog);
        }

    }

    /**
     * This life cycle hook is called when the custom element is detached from the DOM. Although
     * the event listeners will be removed automatically, it's good practice to do this within
     * this method in case a reference is kept outside of the element. 
     */
    disconnectedCallback() {
        EH.detachAll(this._confirmButton, this._cancelButton, this._backdrop, this._modal, this._dialog);
        // if we wouldn't remove the following listener explicitly, it would remain
        EH.detach(`open.${this._uuid}`, Modal._eventBus);
    }

    /**
     * Renders this component.
     */
    _render() {
        this._confirmButton.textContent = this.getAttribute('confirmText') ?? 'Confirm';
    }

    /**
     * Closes the modal if the event's source (another modal) is not the current one.
     * 
     * @param {CustomEvent} event 
     */
    _enforceExclusiveness(event) {
        if (this.isOpen && event.detail.uuid !== this._uuid) {
            this.close();
        }
    }

    /**
     * Opens the modal.
     */
    open() {
        this.setAttribute('open', '');
    }

    /**
     * Closes the modal.
     */
    close() {
        this.removeAttribute('open');
    }

    /**
     * Toggles the visibility of the modal. If open, the modal will be closed
     * and vice versa.
     */
    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    /**
     * This life cycle hook is called when the value of an observed attribute is changed.
     * 
     * @param {string} name attribute name (must be included in `observedAttributes`)
     * @param {string} oldValue old/previous value
     * @param {string} newValue new/next value
     */
    attributeChangedCallback(name, oldValue, newValue) {

        if (name === 'open' && oldValue !== newValue) {

            if (this.hasAttribute('open')) {

                if (!this.shadowRoot.contains(document.activeElement)) {
                    this._triggerElement = document.activeElement;
                }

                this.hasBackdrop ? this._dialog.showModal() : this._dialog.show();

                this._emitOpenEvent();

            }
            else {
                this._dialog.close();
                this._triggerElement?.focus();
                this._emitCloseEvent();
            }

        }

        this._render();

    }

    /**
     * Returns an array of observed attributes. When these attributes change
     * `attributeChangedCallback` is called, otherwise, the method is not.
     */
    static get observedAttributes() {
        return ['open', 'confirmText'];
    }

    /**
     * Emits a custom event `open`.
     */
    _emitOpenEvent() {
        const event = new CustomEvent('open', { detail: { uuid: this._uuid } });
        this.dispatchEvent(event);
        Modal._eventBus.dispatchEvent(event);
    }

    /**
     * Emits a custom event `close`.
     */
    _emitCloseEvent() {
        // triggered on the custom component itself and not within the shadow DOM
        this.dispatchEvent(new CustomEvent('close'));
    }

    /**
     * Emits a custom event `cancel`.
     */
    _emitCancelEvent(clickEvent) {
        // we bubble the event up to the custom component itself
        // if composed is false, the event won't leave the shadow DOM even if bubbles: true
        // easier to call this.dispatchEvent, but leaving that example for further reference
        clickEvent.target.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
    }

    /**
     * Emits a custom event `confirm`.
     */
    _emitConfirmEvent(clickEvent) {
        clickEvent.target.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
    }

}

customElements.define(TAG_NAME, Modal);
