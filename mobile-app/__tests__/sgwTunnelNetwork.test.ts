import sgwTunnelNetwork from '../assets/geo/SGW_Tunnel_Network.geojson';

describe('SGW tunnel network dataset', () => {
  it('contains the expected SGW tunnel corridor refs', () => {
    const corridorRefs = sgwTunnelNetwork.features
      .filter(
        (feature) =>
          feature.geometry.type === 'LineString' &&
          feature.properties.indoor === 'corridor' &&
          feature.properties.highway === 'footway',
      )
      .map((feature) => feature.properties.ref);

    expect(corridorRefs).toEqual(
      expect.arrayContaining([
        'tunnel-LB-H',
        'tunnel-H-metro',
        'tunnel-GM-metro',
        'tunnel-EV-metro',
        'tunnel-EV-MB',
      ]),
    );
  });

  it('keeps tunnel corridors on basement levels only', () => {
    const corridorLevels = sgwTunnelNetwork.features
      .filter((feature) => feature.geometry.type === 'LineString')
      .map((feature) => feature.properties.level);

    expect(corridorLevels.every((level) => level === '-1' || level === '-2')).toBe(true);
  });

  it('includes building entry points and shared junction nodes', () => {
    const entryRefs = sgwTunnelNetwork.features
      .filter(
        (feature) => feature.geometry.type === 'Point' && feature.properties.entrance === 'yes',
      )
      .map((feature) => feature.properties.ref);
    const junctionRefs = sgwTunnelNetwork.features
      .filter(
        (feature) => feature.geometry.type === 'Point' && feature.properties.junction === 'yes',
      )
      .map((feature) => feature.properties.ref);

    expect(entryRefs).toEqual(
      expect.arrayContaining([
        'entry-LB-b1',
        'entry-H-b1-north',
        'entry-H-b1-metro',
        'entry-GM-b1',
        'entry-EV-b1-metro',
        'entry-MB-b2',
      ]),
    );
    expect(junctionRefs).toEqual(
      expect.arrayContaining([
        'junction-LB-H',
        'junction-H-metro',
        'junction-Guy-Concordia',
        'junction-EV-south',
      ]),
    );
  });
});
