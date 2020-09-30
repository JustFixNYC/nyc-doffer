# Load tidyverse package
library(tidyverse)

# Load in 2019 and 2020 rent stab data from raw files
rs_19 <- read_csv('https://s3.amazonaws.com/justfix-data/pluto_19v1_2019_soa.csv')
rs_20 <- read_csv('https://s3.amazonaws.com/justfix-data/pluto_19v2_2020_soa.csv')

# Clean up 2019 and 2020 data to reflect structure of `rentstab_v2` table in nycdb
rs_19_cleaned <- rs_19 %>% 
  filter(success == TRUE) %>% 
  select(bbl, rent_stabilized_units, soa_url) %>%
  rename(ucbbl = bbl, uc2018 = rent_stabilized_units, pdfsoa2018 = soa_url)

rs_20_cleaned <- rs_20 %>% 
  filter(success == TRUE) %>% 
  select(bbl, rent_stabilized_units, soa_url) %>%
  rename(ucbbl = bbl, uc2019 = rent_stabilized_units, pdfsoa2019 = soa_url)

# Join data together, using a full_join to include all data from both tables
rs_joined <- full_join(rs_19_cleaned, rs_20_cleaned, by = "ucbbl") %>% 
  # replace all NA values with the empty string (so it's SQL friendly)
  mutate(across(everything(), ~replace_na(.x, ""))) %>%
  # filter out any bbls without rs units either year
  filter(uc2018 > 0 | uc2019 > 0)

# Write CSV for export:
write_csv(rs_joined, "rentstab_v2.csv")