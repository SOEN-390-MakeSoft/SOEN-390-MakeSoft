describe('ES-1 Map smoke', () => {
  it('opens the app and loads the map screen', async () => {
    try {
      await waitFor(element(by.id('get-started')))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id('get-started')).tap();
    } catch (error) {
      // Already past the welcome screen.
    }

    await waitFor(element(by.id('map-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await waitFor(element(by.id('campus-map')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('campus-label'))).toHaveText('SGW');
    await new Promise((r) => setTimeout(r, 5000));

    await element(by.id('campus-btn-loyola')).tap();
    await waitFor(element(by.id('campus-label')))
      .toHaveText('LOYOLA')
      .withTimeout(10000);

    // Keep the map visible a bit for screen recording.
    await new Promise((r) => setTimeout(r, 5000));
  });
});
