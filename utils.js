/**
 * Static functions to add and remove event listeners without the need of having the
 * same callback function at hand. 
 * 
 * When attaching an event listener, you may extend the event type with a name. Simply
 * separate the type and name with a dot (`.`). For example: `click.cancel`. 
 * 
 * The event type is required to remove a listener. If a name was used, then the name 
 * must be provided too (e.g., `click`, `click.cancel` or `mouseout`).
 */
export class EventHandler {

    static _abortControllers = new WeakMap();

    /**
     * Attach an event listener for the given event type to the given event target. Enhance your event type
     * with a name, if you want to add more than one event listener for the same event type.
     * 
     * @param {string} eventType the event type, optionally followed by a name separated by a dot (.)
     * @param {EventTarget} eventTarget the event target where the event listener will be attached
     * @param {EventListenerOrEventListenerObject} callback the callback function
     */
    static attach(eventType, eventTarget, callback) {

        if (!(eventTarget instanceof EventTarget)) {
            return;
        }

        // make sure there is only one event listener for the given event type
        EventHandler.detach(eventType, eventTarget);

        const controller = new AbortController();

        const controllers = EventHandler._abortControllers.get(eventTarget) ?? new Map();
        controllers.set(eventType, controller);

        eventTarget.addEventListener(eventType.split('.')[0], callback, { signal: controller.signal });

        EventHandler._abortControllers.set(eventTarget, controllers);

    }

    /**
     * Detach the event listener for the given event type from the given event targets.
     * 
     * @param {string} eventType the event type, optionally followed by a name separated by a dot (.)
     * @param {...EventTarget} eventTargets the event targets from which the event listener should be removed
     */
    static detach(eventType, ...eventTargets) {
        
        for (const eventTarget of eventTargets) {

            if (!(eventTarget instanceof EventTarget)) {
                continue;
            }

            const controllers = this._abortControllers.get(eventTarget) ?? false;

            if (controllers === false) {
                // no event listener for the given event target
                continue;
            }

            const controller = controllers.get(eventType) ?? false;

            if (controller === false) {
                // no event listener for the given event type
                continue;
            }
            
            controller.abort();

            if (controllers.delete(eventType) && controller.size === 0) {
                this._abortControllers.delete(eventTarget);
            }

        }

    }

    /**
     * Detach all event listeners from the given event targets.
     * 
     * @param {...EventTarget} eventTargets the event targets from which the event listener should be removed
     */
    static detachAll(...eventTargets) {
        
        for (const eventTarget of eventTargets) {

            if (!(eventTarget instanceof EventTarget)) {
                continue;
            }

            const controllers = this._abortControllers.get(eventTarget) ?? false;

            if (controllers === false) {
                // no event listener for the given event target
                continue;
            }

            for (const controller of controllers.values()) {
                controller.abort();
            }

            controllers.clear();
            this._abortControllers.delete(eventTarget);

        }

    }

}

/**
 * Loads a stylesheet from the given URL.
 * 
 * @param {string} url url pointing to stylesheet
 * @returns {Promise<CSSStyleSheet>} a promise
 */
export async function loadStyleSheet(url) {
    return new Promise(async (resolve, _) => {
        const sheet = new CSSStyleSheet();
        const response = await fetch(url);
        const styles = await response.text();
        sheet.replaceSync(styles)
        resolve(sheet);
    });
}
