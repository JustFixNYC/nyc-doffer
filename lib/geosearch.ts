import { download } from "./download";
import { GEO_AUTOCOMPLETE_URL } from "../static/geo-autocomplete";

/**
 * The keys here were obtained experimentally, I'm not actually sure
 * if/where they are formally specified.
 */
export enum GeoSearchBoroughGid {
  Manhattan = 'whosonfirst:borough:421205771',
  Bronx = 'whosonfirst:borough:421205773',
  Brooklyn = 'whosonfirst:borough:421205765',
  Queens = 'whosonfirst:borough:421205767',
  StatenIsland = 'whosonfirst:borough:421205775',
}

/**
 * This is what the NYC Geosearch API returns from its
 * autocomplete endpoint.
 * 
 * Note that some of the fields are "unknown", which
 * just implies that they exist but we're not really
 * sure what type they are (nor do we particularly
 * care, at the moment, for our purposes).
 */
export interface GeoSearchResults {
  bbox: unknown;
  features: GeoSearchFeature[];
}

export interface GeoSearchFeature {
  geometry: unknown;
  properties: GeoSearchProperties
}

/**
 * Note that these are by no means all the
 * properties, they're just the ones we care about.
 */
export interface GeoSearchProperties {
  /** e.g. "Brooklyn" */
  borough: string;

  /** e.g. "whosonfirst:borough:2" */
  borough_gid: GeoSearchBoroughGid;

  /** e.g. "150" */
  housenumber: string;

  /** e.g. "150 COURT STREET" */
  name: string;

  /** e.g. "150 COURT STREET, Brooklyn, New York, NY, USA" */
  label: string;

  /**
   * The 10-digit padded Borough-Block-Lot (BBL) number for the
   * property, e.g. "3002920026".
   */
  addendum: {
    pad: {
      bbl: string;
    };
  };
}

/**
 * Get the first result from the NYC Planning Labs GeoSearch API for the
 * given search text. Return `null` if there are no matches.
 */
export async function getFirstGeoSearchResult(text: string): Promise<GeoSearchProperties|null> {
  const url = `${GEO_AUTOCOMPLETE_URL}?text=${encodeURIComponent(text)}`;
  const result: GeoSearchResults  = JSON.parse((await download(url)).toString('utf-8'));
  if (!result.features.length) return null;
  return result.features[0].properties;
}
